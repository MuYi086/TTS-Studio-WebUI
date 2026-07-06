<script setup lang="ts">
// @ts-nocheck
/**
 * @fileoverview Unitale WebUI 根组件
 * @description 承载当前迁移阶段的完整工作台界面与浏览器侧编排逻辑
 * - 工作台界面：模型配置、素材资源库、脚本制作、Prompt 管理
 * - 浏览器能力：IndexedDB 持久化、本地媒体缓存、音频播放、视频封装
 * - 服务交互：LLM 文本分析、TTS 合成、Qwen 音色设计、资源同步
 * - 迁移说明：当前已拆分工作台标签页，根组件保留 orchestration，后续继续下沉状态逻辑到 store 与 composable
 * @module src/App
 */
import { computed, onBeforeUpdate, onMounted, provide, ref, watch } from 'vue'
import * as Mp4Muxer from 'mp4-muxer'
import { useAppConfigStore } from './stores/appConfig'
import { INTENSITY_VALUE_MAP, SYSTEM_EMOTIONS, isSystemEmotion } from './constants/emotions'
import { useImagePreview } from './composables/useImagePreview'
import { useModelConfigs } from './composables/useModelConfigs'
import { usePromptTemplates } from './composables/usePromptTemplates'
import { useResourceLibraries } from './composables/useResourceLibraries'
import { useScriptWorkspace } from './composables/useScriptWorkspace'
import { useStageBackground } from './composables/useStageBackground'
import { getJson, postBlob, postForm, postJson } from './utils/http'
import { buildLlmBody, toChatCompletionsUrl } from './utils/llm'
import { toTtsBaseUrl } from './utils/tts'
import { base64ToBlob, blobToBase64 } from './utils/blob'
import { audioBufferToWaveBlob as bufferToWave, makeDistortionCurve } from './utils/audio'
import {
    deleteAssetFromDB,
    initUnitaleDB,
    loadAssetFromDB,
    loadProjectDataFromDB,
    saveAssetToDB,
    saveAssetsBatch,
    saveProjectDataToDB
} from './utils/unitaleDb'
import { workbenchContextKey } from './composables/useWorkbenchContext'
import WorkbenchHeader from './components/workbench/WorkbenchHeader.vue'
import ConfigTab from './components/workbench/ConfigTab.vue'
import TimbresTab from './components/workbench/TimbresTab.vue'
import SfxTab from './components/workbench/SfxTab.vue'
import ScriptTab from './components/workbench/ScriptTab.vue'
import PromptTab from './components/workbench/PromptTab.vue'

const appConfigStore = useAppConfigStore()

/**
 * 将当前工程状态序列化并写入 IndexedDB。
 * @returns {Promise<void>} 保存完成后返回。
 */
const saveProjectToDB = async () => {
    syncCurrentScriptState(); // 确保当前状态同步到列表

    // Prepare data (exclude blobs from JSON, they are in assets store)
    // 使用 JSON 序列化深拷贝，去除 Vue 的 Proxy 代理对象，防止 IndexedDB 报错 DataCloneError
    const plainScriptList = scriptList.value.map(script => {
        const plainLines = (script.data.scriptLines || []).map(l => {
            // 修复：保存时移除 abortController 和临时状态
            const { audioUrl, imageUrl, isGenerating, abortController, ...rest } = l;
            return rest;
        });
        return {
            ...script,
            data: {
                ...script.data,
                scriptLines: plainLines,
                // 确保脚本数据中的角色也是干净的
                characters: (script.data.characters || []).map(c => {
                    const { isAnalyzing, isGeneratingVoice, abortController, ...rest } = c;
                    return rest;
                })
            }
        };
    });

    const projectData = JSON.parse(JSON.stringify({
        // rawScript/scriptLines 不再直接保存，而是保存 scriptList
        // 修复：保存当前角色列表时清理运行时状态
        characters: characters.value.map(c => {
            const { isAnalyzing, isGeneratingVoice, abortController, ...rest } = c;
            return rest;
        }),
        scriptList: plainScriptList,
        currentScriptId: currentScriptId.value,
        libraries: {
            sfx: sfxLibrary.value,
            bgm: bgmLibrary.value,
            timbres: timbres.value,
            filters: filterLibrary.value,
            emotions: emotionPresets.value
        },
        timestamp: Date.now()
    }));

    return saveProjectDataToDB(projectData);
};

let saveTimeout = null;

/**
 * 触发工程自动保存，并对频繁更新做简单防抖。
 * @returns {void}
 */
const triggerAutoSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveProjectToDB().catch(e => console.warn('Auto-save failed', e));
    }, 1000);
};

// 状态
const activeTab = ref(appConfigStore.defaultTab);

watch(activeTab, (newValue) => {
    localStorage.setItem('storyforge_activeTab', newValue);
});
const {
    llmConfigs,
    currentConfigId,
    form,
    isEditing,
    currentConfig,
    saveConfig,
    editConfig,
    deleteConfig,
    resetForm,
    ttsConfigs,
    currentTtsConfigId,
    ttsForm,
    isEditingTts,
    currentTtsConfig,
    saveTtsConfig,
    editTtsConfig,
    deleteTtsConfig,
    resetTtsForm
} = useModelConfigs();

const {
    characters,
    addCharacter,
    deleteCharacter,
    timbres,
    timbreForm,
    isEditingTimbre,
    handleTimbreFileUpload,
    syncTimbresWithServer,
    saveTimbre,
    editTimbre,
    deleteTimbre,
    resetTimbreForm,
    emotionPresets,
    emotionForm,
    isEditingEmotion,
    saveEmotion,
    editEmotion,
    deleteEmotion,
    resetEmotionForm,
    sfxLibrary,
    sfxForm,
    isEditingSfx,
    saveSfx,
    editSfx,
    deleteSfx,
    resetSfxForm,
    handleSfxFileUpload,
    bgmLibrary,
    bgmForm,
    isEditingBgm,
    saveBgm,
    editBgm,
    deleteBgm,
    resetBgmForm,
    handleBgmFileUpload,
    filterLibrary,
    filterForm,
    isEditingFilter,
    saveFilter,
    editFilter,
    deleteFilter,
    resetFilterForm
} = useResourceLibraries({
    getLocalFileMap: () => localFileMap.value,
    loadAudioBuffer: (filename) => loadAudioBuffer(filename),
    triggerAutoSave,
    currentTtsConfig,
    currentTtsConfigId,
    ttsConfigs
});

// 聊天状态
const prompt = ref('');
const result = ref('');
const reasoning = ref('');
const error = ref('');
const loading = ref(false);
const abortController = ref(null);

const ttsRefFile = ref(null);
const ttsRefPath = ref('uploaded/ref.wav'); // 默认路径示例
const ttsEmoText = ref('中立');
const audioUrl = ref('');
const ttsLoading = ref(false);
const ttsError = ref('');
const ttsAbortController = ref(null);

// 脚本制作状态
const rawScript = ref('');
const scriptLines = ref([]);
const isAnalyzingScript = ref(false);
const rawAnalysisResult = ref('');
const analysisAbortController = ref(null);
const selectedLineIndex = ref(-1);

const isGeneratingAll = ref(false);
const isSequencePlaying = ref(false);

// ==================== Script Workspace ====================

const {
    scriptList,
    currentScriptId,
    editingScriptId,
    scriptNameInputRefs,
    syncCurrentScriptState,
    switchScript,
    addScript,
    startEditingScript,
    stopEditingScript,
    deleteScriptTab
} = useScriptWorkspace({
    rawScript,
    scriptLines,
    rawAnalysisResult,
    characters,
    isAnalyzingScript,
    isGeneratingAll,
    isSequencePlaying,
    selectedLineIndex,
    triggerAutoSave
});

const currentSequenceIndex = ref(-1);
const lineRefs = ref([]);
const scriptListContainer = ref(null);
onBeforeUpdate(() => {
    lineRefs.value = [];
});
let sequenceAbortController = null;
const isExportingAudio = ref(false);
const importFileRef = ref(null);
const importTxtRef = ref(null);
const isExportingProject = ref(false);
const exportStatus = ref('');
const isGeneratingVideo = ref(false);
const videoResolution = ref('1920x1080');
let bgmAudioNode = null;
let bgmGainNode = null;
const playbackProgress = ref(0);
const {
    stageBgUrl,
    stageBgFadePrevUrl,
    stageBgFadeStartTs,
    stageBgFadeDurationMs,
    setStageBgUrlWithFade,
    clearStageBgWithFade
} = useStageBackground();
const bgImageCount = ref(0); // 背景图片块数量（bgImage 对象个数）
const bgImagePickerRef = ref(null);
const {
    previewImageUrl,
    openImagePreview,
    closeImagePreview
} = useImagePreview();
const pendingBgImageLineIndex = ref(-1);
let playbackAnimationFrame = null;
const isRestoring = ref(false); // 新增：恢复数据时的锁

// 剪辑拖拽状态
const draggingTrimState = ref(null);

const {
    customPromptTemplate,
    useCustomPrompt,
    scriptPromptTemplate,
    customVoicePromptTemplate,
    useCustomVoicePrompt,
    voicePromptTemplate,
    customQwenVoiceTextTemplate,
    useCustomQwenVoiceText,
    qwenVoiceTextTemplate,
    savePrompt,
    saveVoicePrompt,
    resetPrompt,
    resetVoicePrompt,
    saveQwenVoiceText,
    resetQwenVoiceText
} = usePromptTemplates();

// ==================== Audio Engine & Cache ====================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let videoRecordingAudioDestination = null;
const getAudioOutputNode = () => videoRecordingAudioDestination || audioContext.destination;
const audioBufferCache = new Map();
const localFileMap = ref(new Map());

/**
 * 按文件名或 URL 加载音频并解码为 AudioBuffer。
 * @param {string} filename - 音频文件名、HTTP 地址或 Blob URL。
 * @returns {Promise<AudioBuffer | null>} 解码后的音频缓冲区。
 */
const loadAudioBuffer = async (filename) => {
    if (!filename) return null;
    if (audioBufferCache.has(filename)) return audioBufferCache.get(filename);

    try {
        let arrayBuffer;
        if (localFileMap.value.has(filename)) {
            arrayBuffer = await localFileMap.value.get(filename).arrayBuffer();
        } else if (filename.match(/^(https?:\/\/|blob:)/)) {
            const res = await fetch(filename);
            if (!res.ok) throw new Error(`Failed to fetch ${filename}`);
            arrayBuffer = await res.arrayBuffer();
        } else {
            // 兜底：尝试从本地相对路径（如 voice 目录）加载
            try {
                const localRes = await fetch(`voice/${filename}`);
                if (!localRes.ok) {
                    // 尝试根目录
                    const rootRes = await fetch(filename);
                    if (!rootRes.ok) throw new Error('Not found');
                    arrayBuffer = await rootRes.arrayBuffer();
                } else {
                    arrayBuffer = await localRes.arrayBuffer();
                }
            } catch (e) {
                throw new Error(`Audio file not found in memory or local path: ${filename}`);
            }
        }
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferCache.set(filename, buffer);
        return buffer;
    } catch (e) {
        console.warn(`Failed to load audio: ${filename}`, e);
        return null;
    }
};

// ==================== Preview Playback ====================

const previewPlayingFile = ref(null);
let previewSource = null;

/**
 * 预览资源库中的音频素材或音色样本。
 * @param {string | Record<string, any>} item - 文件名或资源对象。
 * @returns {Promise<void>}
 */
const playPreview = async (item) => {
    if (audioContext.state === 'suspended') await audioContext.resume();

    if (previewSource) {
        try { previewSource.stop(); } catch (e) { }
        previewSource = null;
    }
    if (playbackAnimationFrame) {
        cancelAnimationFrame(playbackAnimationFrame);
        playbackAnimationFrame = null;
    }

    let filename, volume, trimStart, trimEnd;

    if (typeof item === 'string') {
        filename = item;
        volume = 1.0;
        trimStart = 0;
        trimEnd = 1;
    } else if (typeof item === 'object' && item !== null) {
        filename = item.filename || item.refPath;
        volume = item.volume ?? 1.0;
        trimStart = item.trimStart ?? 0;
        trimEnd = item.trimEnd ?? 1;
    } else {
        return;
    }

    if (previewPlayingFile.value === filename) {
        previewPlayingFile.value = null;
        playbackProgress.value = 0;
        return;
    }

    if (!filename) return;

    const buffer = await loadAudioBuffer(filename);
    if (buffer) {
        previewSource = audioContext.createBufferSource();
        previewSource.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

        previewSource.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const duration = buffer.duration;
        const startTimeOffset = duration * trimStart;
        const playDuration = duration * (trimEnd - trimStart);

        const now = audioContext.currentTime;

        previewSource.onended = () => {
            if (previewPlayingFile.value === filename) {
                previewPlayingFile.value = null;
                playbackProgress.value = 0;
            }
            if (playbackAnimationFrame) {
                cancelAnimationFrame(playbackAnimationFrame);
                playbackAnimationFrame = null;
            }
        };
        previewSource.start(now, startTimeOffset, playDuration);
        previewPlayingFile.value = filename;

        // Progress bar logic
        const updateProgress = () => {
            if (previewPlayingFile.value !== filename) return;
            const elapsed = audioContext.currentTime - now;
            if (elapsed >= 0) {
                const progress = trimStart + (elapsed / duration);
                playbackProgress.value = Math.min(progress, trimEnd);
            } else {
                playbackProgress.value = trimStart;
            }

            if (audioContext.currentTime < now + playDuration) {
                playbackAnimationFrame = requestAnimationFrame(updateProgress);
            } else {
                playbackProgress.value = trimEnd;
            }
        };
        playbackAnimationFrame = requestAnimationFrame(updateProgress);
    }
};

const preloadAudioAssets = async () => {
    // 移除启动时的自动预加载，因为现在没有持久化的文件列表
    // 仅在导入工程后或添加文件时加载
};

// ==================== Waveform & Trim ====================

/**
 * 在 canvas 上绘制音频波形，供剪辑条使用。
 * @param {HTMLCanvasElement} canvas - 波形画布节点。
 * @param {Record<string, any>} item - 含音频路径的资源对象。
 * @returns {Promise<void>}
 */
const drawWaveform = async (canvas, item) => {
    const audioPath = item.audioUrl || item.filename || item.refPath;
    if (!canvas || !audioPath) return;

    if (canvas._lastUrl === audioPath) return;
    canvas._lastUrl = audioPath;

    const buffer = await loadAudioBuffer(audioPath);
    if (!buffer) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
};

/**
 * 启动裁剪把手拖拽并同步 trimStart/trimEnd。
 * @param {MouseEvent} e - 鼠标按下事件。
 * @param {Record<string, any>} item - 当前资源对象。
 * @param {'start' | 'end'} type - 拖拽的是起点还是终点。
 * @returns {void}
 */
const startDragTrim = (e, item, type) => {
    draggingTrimState.value = {
        item: item,
        type: type, // 'start' or 'end'
        startX: e.clientX,
        containerWidth: e.target.closest('.relative').offsetWidth,
        startVal: type === 'start' ? (item.trimStart ?? 0) : (item.trimEnd ?? 1)
    };

    const onMove = (ev) => {
        if (!draggingTrimState.value) return;
        const state = draggingTrimState.value;
        const item = state.item;
        if (!item) return;

        const deltaX = ev.clientX - state.startX;
        const deltaPercent = deltaX / state.containerWidth;
        let newVal = Math.max(0, Math.min(1, state.startVal + deltaPercent));

        if (state.type === 'start') {
            item.trimStart = Math.min(newVal, (item.trimEnd ?? 1) - 0.01);
        } else {
            item.trimEnd = Math.max(newVal, (item.trimStart ?? 0) + 0.01);
        }
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        draggingTrimState.value = null;
        triggerAutoSave(); // 保存剪辑结果
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
};

// Watchers for Auto-Save
watch([rawScript, characters, sfxLibrary, bgmLibrary, timbres, filterLibrary, emotionPresets], () => {
    if (isRestoring.value) return; // 如果正在恢复数据，不触发自动保存
    triggerAutoSave();
}, { deep: true });

watch(scriptLines, () => {
    triggerAutoSave();
}, { deep: true });

watch(bgImageCount, () => {
    localStorage.setItem('unitale_bgImageCount', String(Math.max(0, Number(bgImageCount.value) || 0)));
});

// 读取持久化配置
onMounted(async () => {
     const savedBgImageCount = localStorage.getItem('unitale_bgImageCount');
     if (savedBgImageCount !== null) {
         const parsedBgImageCount = Number(savedBgImageCount);
         bgImageCount.value = Number.isFinite(parsedBgImageCount) ? Math.max(0, parsedBgImageCount) : 0;
     }
 
     // --- Restore from IndexedDB ---
     try {
         await initUnitaleDB();
         isRestoring.value = true; // 开始恢复，暂停自动保存
 
         // 1. Load Project Data
         const projectData = await loadProjectDataFromDB();
 
         if (projectData) {
             // --- STAGE 1: Restore all text/JSON data immediately ---
             console.log('Project data found, restoring text and metadata...');
 
             // Restore libraries (metadata only)
            if (projectData.libraries) {
                sfxLibrary.value = (projectData.libraries.sfx || []).map(s => ({ ...s, volume: s.volume ?? 0.3 }));
                bgmLibrary.value = (projectData.libraries.bgm || []).map(b => ({ ...b, volume: b.volume ?? 0.3 }));
                timbres.value = projectData.libraries.timbres || [];
                filterLibrary.value = projectData.libraries.filters || filterLibrary.value; // Fallback to default if not in save
                 
                 if (projectData.libraries.emotions && Array.isArray(projectData.libraries.emotions)) {
                     const customLoaded = projectData.libraries.emotions.filter(e => !isSystemEmotion(e.name) && Array.isArray(e.vector));
                     const systemLoaded = projectData.libraries.emotions.filter(e => isSystemEmotion(e.name));
                    const mergedSystem = SYSTEM_EMOTIONS.map(def => {
                        const saved = systemLoaded.find(s => s.name === def.name);
                        return { ...def, enabled: saved ? saved.enabled : undefined };
                    });
                    emotionPresets.value = [...mergedSystem, ...customLoaded];
                }
            }

            // Restore script list (metadata only)
            if (projectData.scriptList && Array.isArray(projectData.scriptList)) {
                projectData.scriptList.forEach(script => {
                    if (script.data && script.data.scriptLines) {
                         script.data.scriptLines = script.data.scriptLines.map(lineData => {
                             return { trimStart: 0, trimEnd: 1, ...lineData, imageUrl: '', audioUrl: '', isGenerating: false };
                         });
                     }
                 });
                 scriptList.value = projectData.scriptList;
                 currentScriptId.value = projectData.currentScriptId || (scriptList.value.length > 0 ? scriptList.value[0].id : 'default');
             } else {
                 // Compatibility for older format
                 scriptList.value = [{
                     id: 'default',
                     name: '脚本 1',
                     data: {
                         rawScript: projectData.rawScript || '',
                         scriptLines: (projectData.scriptLines || []).map(lineData => ({ trimStart: 0, trimEnd: 1, ...lineData, imageUrl: '', audioUrl: '', isGenerating: false })),
                         rawAnalysisResult: projectData.rawAnalysisResult || '',
                         characters: projectData.characters || []
                     }
                 }];
                 currentScriptId.value = 'default';
             }
 
             // Load active script into view immediately
             const active = scriptList.value.find(s => s.id === currentScriptId.value);
             if (active) {
                 rawScript.value = active.data.rawScript || '';
                 scriptLines.value = active.data.scriptLines || [];
                 rawAnalysisResult.value = active.data.rawAnalysisResult || '';
                 characters.value = active.data.characters || [];
                 characters.value.forEach(c => { if (c.volume === undefined) c.volume = 1.0; });
             }
             
             console.log('Project text data restored. Loading audio in background...');
 
             // --- STAGE 2: Load audio assets in the background ---
             setTimeout(async () => {
                 const restoreAssets = async (lib, fileKey) => {
                     if (!lib) return;
                     for (const item of lib) {
                         const filename = item[fileKey];
                         if (filename) {
                             if (localFileMap.value.has(filename)) continue;
                             const blob = await loadAssetFromDB(filename);
                             if (blob) {
                                 const file = new File([blob], filename, { type: blob.type });
                                 localFileMap.value.set(filename, file);
                                 loadAudioBuffer(filename); // Pre-cache decoded buffer
                             }
                         }
                     }
                 };
                 
                 await restoreAssets(sfxLibrary.value, 'filename');
                 await restoreAssets(bgmLibrary.value, 'filename');
                 await restoreAssets(timbres.value, 'refPath');
                 
                 const allChars = scriptList.value.flatMap(s => s.data.characters || []);
                 await restoreAssets(allChars, 'voiceFile');
 
                 // Restore script line audio
                 for (const script of scriptList.value) {
                     const lines = script.data.scriptLines || [];
                     for (const line of lines) {
                        if (line.type === 'dialogue') {
                             const audioKey = `line_audio_${line.id}`;
                             const blob = await loadAssetFromDB(audioKey);
                             if (blob) {
                                 line.audioUrl = URL.createObjectURL(blob);
                             }
                        } else if (line.type === 'bgImage') {
                            const bgKey = line.bgImageAssetKey || `bgImage_${line.id}`;
                            const blob = await loadAssetFromDB(bgKey);
                            if (blob) {
                                line.imageUrl = URL.createObjectURL(blob);
                            }
                         }
                     }
                 }
                 console.log('Background audio loading complete.');
             }, 100); // Small delay to let UI render first
 
         }
     } catch (e) {
         console.error('Failed to restore from IndexedDB', e);
     } finally {
         // Slightly longer delay to ensure background loading has started
         setTimeout(() => { isRestoring.value = false; }, 500);
     }
});

// ==================== Character Voice Workflow ====================

/**
 * 调用 LLM 为角色生成音色描述文本。
 * @param {Record<string, any>} char - 当前角色对象。
 * @returns {Promise<void>}
 */
const analyzeCharacterVoice = async (char) => {
    if (char.isAnalyzing) {
        if (char.abortController) char.abortController.abort();
        return;
    }

    if (!currentConfig.value) return alert('请先在“模型配置”中配置 LLM');
    if (!rawScript.value.trim()) return alert('请先在右侧输入小说原文');

    char.isAnalyzing = true;
    const controller = new AbortController();
    char.abortController = controller;

    try {
        const promptText = voicePromptTemplate.value
            .replace(/\${charName}/g, char.name)
            .replace(/\${rawScript}/g, rawScript.value.substring(0, 3000));

        const cfg = currentConfig.value;
        const url = toChatCompletionsUrl(cfg.baseUrl);
        const body = buildLlmBody(cfg, [{ role: 'user', content: promptText }]);
        const data = await postJson(url, body, {
            headers: { Authorization: `Bearer ${cfg.key}` },
            signal: controller.signal
        });
        const content = data.choices[0]?.message?.content || '';
        char.voiceDescription = content.trim();
    } catch (e) {
        if (e.name !== 'AbortError') {
            alert('分析失败: ' + e.message);
        }
    } finally {
        char.isAnalyzing = false;
        delete char.abortController;
    }
};

/**
 * 调用 Qwen 音色设计接口生成角色参考音频并回填音色库。
 * @param {Record<string, any>} char - 当前角色对象。
 * @returns {Promise<void>}
 */
const generateQwenVoice = async (char) => {
    if (char.isGeneratingVoice) {
        if (char.abortController) char.abortController.abort();
        return;
    }

    if (!currentTtsConfig.value) return alert('请先选择 TTS 服务');
    if (!char.voiceDescription) return alert('请先填写音色描述');

    char.isGeneratingVoice = true;
    const startTime = Date.now();
    const controller = new AbortController();
    char.abortController = controller;

    // 设置 30 分钟 (1800秒) 的前端超时时间，防止前端代码主动放弃
    const timeoutId = setTimeout(() => {
        if (char.abortController) char.abortController.abort("timeout");
    }, 1800000);

    try {
        const cfg = currentTtsConfig.value;
        const baseUrl = toTtsBaseUrl(cfg.baseUrl);

        const textToUse = qwenVoiceTextTemplate.value.replace(/\${charName}/g, char.name).replace(/\${char\.name}/g, char.name);

        const payload = {
            voice_description: char.voiceDescription,
            text: textToUse
        };

        // 1. 调用 Qwen3 生成音频
        const blob = await postBlob(`${baseUrl}/v1/qwen/design`, payload, {
            headers: { 'Cache-Control': 'no-store' },
            signal: controller.signal
        });
        const filename = `qwen_${char.name}_${Date.now()}.wav`;
        const file = new File([blob], filename, { type: 'audio/wav' });

        // 2. 保存到本地资源管理
        localFileMap.value.set(filename, file);
        await saveAssetToDB(filename, file);

        // 3. 上传回 TTS 服务器 (用于 IndexTTS 调用)
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('full_path', filename);

        await postForm(`${baseUrl}/v1/upload_audio`, formData, {
            signal: controller.signal
        });

        // 4. 添加或更新音色库
        const timbreName = `${char.name}_AI`;
        const existingIndex = timbres.value.findIndex(t => t.name === timbreName);

        if (existingIndex !== -1) {
            // 更新已有音色
            timbres.value[existingIndex].description = char.voiceDescription;
            timbres.value[existingIndex].refPath = filename;
        } else {
            // 新增音色
            timbres.value.push({
                id: Date.now().toString(),
                name: timbreName,
                description: char.voiceDescription,
                refPath: filename
            });
        }

        // 5. 选中该音色
        char.voiceFile = filename;

        // 6. 自动保存
        triggerAutoSave();

    } catch (e) {
        console.error(e);
        let msg = e.message;
        const duration = (Date.now() - startTime) / 1000;

        if (e.name === 'AbortError') {
            if (controller.signal.reason === "timeout") {
                msg = '请求超时 (超过 30 分钟)。请检查后端是否卡死。';
            } else {
                msg = '操作已手动取消。';
            }
        } else if (msg === 'Failed to fetch') {
            msg = `连接异常中断 (耗时 ${Math.round(duration)}秒)。\n这不是前端代码设定的超时(30分钟)，而是您的浏览器或网络环境(如代理/Nginx)强制断开了连接。\n\n由于无法修改后端保存文件，此音频已丢失。\n建议：尝试精简音色描述以减少生成时间。`;
        }
        alert('生成音色失败: ' + msg);
    } finally {
        clearTimeout(timeoutId);
        char.isGeneratingVoice = false;
        delete char.abortController;
    }
};
const availableRoles = computed(() => {
    const roles = new Set(characters.value.map(c => c.name));
    return Array.from(roles);
});

// --- 拖拽与排序逻辑 ---
const draggingIndex = ref(-1);
const moveLineUp = (index) => {
    if (index <= 0) return;
    const item = scriptLines.value.splice(index, 1)[0];
    scriptLines.value.splice(index - 1, 0, item);
};
const moveLineDown = (index) => {
    if (index >= scriptLines.value.length - 1) return;
    const item = scriptLines.value.splice(index, 1)[0];
    scriptLines.value.splice(index + 1, 0, item);
};

const toggleLineSelection = (index, event) => {
    if (event) {
        // 如果点击的是交互式控件（输入框、按钮、下拉框等）或其内部元素，则不切换选中状态
        const interactive = event.target.closest('input, select, textarea, button, label, a');
        if (interactive) return;
    }
    if (selectedLineIndex.value === index) {
        selectedLineIndex.value = -1;
    } else {
        selectedLineIndex.value = index;
    }
};

let dialogueSource = null;
let sfxSources = [];
const isAuditioningId = ref(null);

/**
 * 为单条台词生成 TTS 音频，并在必要时补传参考音色。
 * @param {Record<string, any>} line - 脚本中的台词行对象。
 * @param {AbortSignal | null} [externalSignal=null] - 批量生成时的外部取消信号。
 * @returns {Promise<void>}
 */
const generateLineAudio = async (line, externalSignal = null) => {
    // This button is a toggle. If the line is already generating, this aborts it.
    if (line.isGenerating) {
        if (line.abortController) {
            line.abortController.abort();
        }
        return; // The finally block of the original call will handle cleanup.
    }

    if (!currentTtsConfig.value) {
        alert('请先在 TTS 配置中心选择一个 TTS 服务');
        return;
    }

    line.isGenerating = true;
    const controller = new AbortController();
    line.abortController = controller;
    const internalSignal = controller.signal;

    // Link external signal if provided (for batch abort)
    const handleExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', handleExternalAbort);

    try {
        const char = characters.value.find(c => c.name === line.role);
        if (!char || !char.voiceFile) {
            throw new Error(`角色 "${line.role}" 未绑定音色文件路径。\n\n请在左侧的角色列表中为该角色选择一个音色文件，或手动输入路径。`);
        }

        let finalVector = [0, 0, 0, 0, 0, 0, 0, 0];
        const preset = emotionPresets.value.find(e => e.name === line.emotion);
        if (preset && preset.vector) {
            if (isSystemEmotion(line.emotion)) {
                const intensityVal = INTENSITY_VALUE_MAP[line.intensity] || 0.5;
                finalVector = preset.vector.map(v => v * intensityVal);
            } else {
                finalVector = preset.vector;
            }
        }

        const payload = {
            text: line.text,
            audio_path: char.voiceFile,
            emo_vector: finalVector
        };

        const cfg = currentTtsConfig.value;
        const baseUrl = toTtsBaseUrl(cfg.baseUrl);

        const voiceFile = localFileMap.value.get(char.voiceFile);
        if (voiceFile) {
            try {
                const checkUrl = `${baseUrl}/v1/check/audio?file_name=${encodeURIComponent(char.voiceFile)}`;
                const checkData = await getJson(checkUrl, { signal: internalSignal });
                const exists = Boolean(checkData.exists);
                if (!exists) {
                    const formData = new FormData();
                    formData.append('audio', voiceFile, char.voiceFile);
                    formData.append('full_path', char.voiceFile);
                    await postForm(`${baseUrl}/v1/upload_audio`, formData, { signal: internalSignal });
                }
            } catch (e) {
                if (e.name !== 'AbortError') console.warn('自动上传音色文件失败:', e);
                else throw e; // Propagate abort
            }
        }

        const blob = await postBlob(`${baseUrl}/v2/synthesize`, payload, {
            signal: internalSignal
        });
        await saveAssetToDB(`line_audio_${line.id}`, blob);
        const audioUrl = URL.createObjectURL(blob);
        line.audioUrl = audioUrl;
        line.trimStart = 0;
        line.trimEnd = 1;

    } catch (e) {
        // Don't show alert for abort errors, just log and re-throw
        if (e.name !== 'AbortError') {
            alert(e.message);
            console.error(e);
        }
        throw e; // Re-throw so the caller (e.g., generateAllLines) knows about the failure.
    } finally {
        line.isGenerating = false;
        delete line.abortController;
        externalSignal?.removeEventListener('abort', handleExternalAbort);
    }
};

                let batchAbortController = null;

                const generateAllLines = async () => {

                    if (isGeneratingAll.value) {

                        if (batchAbortController) {

                            batchAbortController.abort();

                        }

                        return;

                    }



                    const startIndex = selectedLineIndex.value !== -1 ? selectedLineIndex.value : 0;

                    const linesToCheck = scriptLines.value.slice(startIndex);



                    // Pre-flight check on lines that will be processed

                    const linesToProcess = linesToCheck.filter(l => l.type === 'dialogue' && !l.audioUrl);

                    for (const line of linesToProcess) {

                        const char = characters.value.find(c => c.name === line.role);

                        if (!char || !char.voiceFile) {

                            const lineIndex = scriptLines.value.findIndex(l => l.id === line.id);

                            alert(`一键生成已终止。\n\n原因：第 ${lineIndex + 1} 行台词的角色（${line.role}）没有绑定音源。`);

                            return;

                        }

                    }



                    const dialogueCount = linesToProcess.length;

                    if (dialogueCount === 0) {

                        alert('没有需要生成的台词音频。');

                        return;

                    }



                    const confirmMsg = startIndex > 0

                        ? `即将从第 ${startIndex + 1} 行（选中行）开始，为后续 ${dialogueCount} 条【未生成】的台词生成音频。确定继续吗？`

                        : `即将为全部 ${dialogueCount} 条【未生成】的台词生成音频。确定继续吗？`;



                    if (!confirm(confirmMsg)) return;



                    isGeneratingAll.value = true;

                    batchAbortController = new AbortController();

                    const batchSignal = batchAbortController.signal;

                    let failedCount = 0;



                    try {

                        // Iterate through the original slice to maintain order, but only process what's needed.

                        for (const line of linesToCheck) {

                            if (batchSignal.aborted) break;



                            if (line.type === 'dialogue' && !line.audioUrl) {

                                try {

                                    await generateLineAudio(line, batchSignal);

                                } catch (e) {

                                    if (e.name !== 'AbortError') {

                                        console.error(`Error generating line for role ${line.role}:`, e);

                                        failedCount++;

                                    }

                                }

                            }

                        }



                        if (batchSignal.aborted) {

                            alert('批量生成已停止。');

                        } else if (failedCount > 0) {

                            alert(`一键生成完成，但有 ${failedCount} 条台词生成失败。请检查控制台或单独重新生成失败的台词。`);

                        } else {

                            await saveProjectToDB();

                            alert('批量生成完成！');

                        }

                    } catch (e) {

                        console.error("生成全部音频时发生意外错误:", e);

                        alert('生成过程中出现未知错误，详情请查看控制台。');

                    } finally {

                        isGeneratingAll.value = false;

                        batchAbortController = null;

                    }

                };



                const clearAllGeneratedAudio = async () => {

                    const linesWithAudio = scriptLines.value.filter(l => l.audioUrl);

                    if (linesWithAudio.length === 0) {

                        return alert('没有已生成的音频可以清除。');

                    }

                    if (!confirm(`确定要清除所有 ${linesWithAudio.length} 条已生成的音频吗？此操作不可撤销。`)) {

                        return;

                    }



                    for (const line of linesWithAudio) {

                        // Don't wait for each one, do them in parallel

                        clearLineAudio(line);

                    }



                    alert('所有已生成的音频已被清除。');

                };

const playLineAudio = (line, stopPreviousSfx = true) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Resume AudioContext if it's suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // 2. Stop anything currently playing
            if (dialogueSource) {
                dialogueSource.onended = null; // Prevent onended from firing on manual stop
                dialogueSource.stop();
                dialogueSource = null;
            }

            if (playbackAnimationFrame) {
                cancelAnimationFrame(playbackAnimationFrame);
                playbackAnimationFrame = null;
            }

            if (stopPreviousSfx) {
                sfxSources.forEach(source => { try { source.stop(); } catch (e) { } });
                sfxSources = [];
            }

            // If it was a stop request (clicking the same line in manual mode)
            if (isAuditioningId.value === line.id) {
                isAuditioningId.value = null;
                return resolve();
            }

            if (!line.audioUrl) return resolve(); // Resolve silently if no audio

            isAuditioningId.value = line.id;

            // 3. Prepare loading promises (Parallel loading)
            const loadDialogue = async () => {
                const res = await fetch(line.audioUrl);
                const ab = await res.arrayBuffer();
                return await audioContext.decodeAudioData(ab);
            };

            const loadSfx = async () => {
                if (!line.sfx || line.sfx.length === 0) return [];
                const promises = line.sfx.map(async (sfxItem) => {
                    const sfxLibItem = sfxLibrary.value.find(s => s.name === sfxItem.name);
                    if (sfxLibItem && sfxLibItem.filename) {
                        const buf = await loadAudioBuffer(sfxLibItem.filename);
                        if (buf) return { 
                            buffer: buf, 
                            item: sfxItem, 
                            libVolume: sfxLibItem.volume ?? 1.0,
                            trimStart: sfxLibItem.trimStart ?? 0,
                            trimEnd: sfxLibItem.trimEnd ?? 1
                        };
                    }
                    return null;
                });
                const results = await Promise.all(promises);
                return results.filter(r => r !== null);
            };

            // 4. Execute loads in parallel
            const [dialogueBuffer, sfxBuffers] = await Promise.all([
                loadDialogue(),
                loadSfx()
            ]);

            // 5. Set up dialogue
            dialogueSource = audioContext.createBufferSource();
            dialogueSource.buffer = dialogueBuffer;

            // 计算剪辑参数
            const trimStart = line.trimStart || 0;
            const trimEnd = line.trimEnd || 1;
            const duration = dialogueBuffer.duration;
            const startTimeOffset = duration * trimStart;
            const playDuration = duration * (trimEnd - trimStart);
            const speed = line.speed || 1.0;

            const dialogueGain = audioContext.createGain();
            const char = characters.value.find(c => c.name === line.role);
            const charVol = char ? (char.volume ?? 1.0) : 1.0;
            dialogueGain.gain.setValueAtTime((line.dialogueVolume ?? 1.0) * charVol, audioContext.currentTime);

            // --- Filter Logic ---
            let lastNode = dialogueSource;

            if (line.filter) {
                const filterConfig = filterLibrary.value.find(f => f.name === line.filter);
                if (filterConfig) {
                    if (filterConfig.type === 'distortion') {
                        const waveShaper = audioContext.createWaveShaper();
                        waveShaper.curve = makeDistortionCurve(filterConfig.gain);
                        waveShaper.oversample = '4x';
                        lastNode.connect(waveShaper);
                        lastNode = waveShaper;
                    } else {
                        const biquad = audioContext.createBiquadFilter();
                        biquad.type = filterConfig.type;
                        biquad.frequency.value = filterConfig.frequency;
                        biquad.Q.value = filterConfig.Q;
                        lastNode.connect(biquad);
                        lastNode = biquad;
                    }
                }
            }

            // Connect to gain then destination
            lastNode.connect(dialogueGain).connect(getAudioOutputNode());
            dialogueSource.playbackRate.value = speed;

            const now = audioContext.currentTime + 0.05; // Slight delay for sync

            // 6. Schedule SFX
            sfxBuffers.forEach(({ buffer, item, libVolume, trimStart: sfxTrimStart, trimEnd: sfxTrimEnd }) => {
                const originalDuration = dialogueBuffer.duration;
                const absStart = originalDuration * trimStart;
                const absEnd = originalDuration * trimEnd;
                const trimmedDuration = absEnd - absStart;
                const pos = parseFloat(item.position) || 0;
                // 修正：位置应该是相对于裁剪后的时长
                const absSfxTime = absStart + (trimmedDuration * pos);

                if (absSfxTime >= absStart && absSfxTime <= absEnd) {
                    const sSrc = audioContext.createBufferSource();
                    sSrc.buffer = buffer;
                    const sGain = audioContext.createGain();
                    const finalSfxVol = (line.sfxVolume ?? 0.5) * (libVolume ?? 1.0);
                    sGain.gain.setValueAtTime(finalSfxVol, now);
                    sSrc.connect(sGain).connect(getAudioOutputNode());

                    const relativeStart = absSfxTime - absStart;
                    const sOffset = buffer.duration * sfxTrimStart;
                    const sDuration = buffer.duration * (sfxTrimEnd - sfxTrimStart);
                    sSrc.start(now + relativeStart / speed, sOffset, sDuration);

                    sfxSources.push(sSrc);
                    sSrc.onended = () => {
                        const idx = sfxSources.indexOf(sSrc);
                        if (idx > -1) sfxSources.splice(idx, 1);
                    };
                }
            });

            // 7. Play dialogue
            dialogueSource.onended = async () => {
                // This event fires on natural end or manual .stop()
                if (playbackAnimationFrame) {
                    cancelAnimationFrame(playbackAnimationFrame);
                    playbackAnimationFrame = null;
                }
                if (isAuditioningId.value === line.id) {
                    isAuditioningId.value = null;
                }
                resolve();
            };

            dialogueSource.start(now, startTimeOffset, playDuration);

            // 启动进度条动画
            const updateProgress = () => {
                if (isAuditioningId.value !== line.id) return;
                const elapsed = audioContext.currentTime - now;
                if (elapsed >= 0) {
                    // 计算当前在整个文件中的百分比位置
                    // 当前位置 = (startTimeOffset + elapsed) / totalDuration
                    // startTimeOffset = duration * trimStart
                    // => (duration * trimStart + elapsed) / duration
                    // => trimStart + (elapsed / duration)
                    const progress = trimStart + (elapsed * speed / duration);
                    playbackProgress.value = Math.min(progress, trimEnd);
                } else {
                    playbackProgress.value = trimStart;
                }

                if (audioContext.currentTime < now + (playDuration / speed)) {
                    playbackAnimationFrame = requestAnimationFrame(updateProgress);
                } else {
                    playbackProgress.value = trimEnd;
                }
            };
            playbackAnimationFrame = requestAnimationFrame(updateProgress);

        } catch (e) {
            console.error("Failed to play audio:", e);
            // alert('播放音频失败，请检查文件或网络。'); // Suppress alert for smoother UX
            isAuditioningId.value = null;
            resolve(); // Resolve to not block sequence
        }
    });
};

const clearLineAudio = async (line) => {
    if (!line.audioUrl) return;

    const audioUrlToDelete = line.audioUrl;
    const audioKey = `line_audio_${line.id}`;

    line.audioUrl = '';
    URL.revokeObjectURL(audioUrlToDelete);

    if (audioBufferCache.has(audioUrlToDelete)) {
        audioBufferCache.delete(audioUrlToDelete);
    }

    try {
        await deleteAssetFromDB(audioKey);
    } catch (e) {
        console.error(`Failed to delete asset ${audioKey} from DB`, e);
    }

    triggerAutoSave();
};

// ==================== Project Import & Export ====================

/**
 * 导出包含素材与脚本状态的完整工程文件。
 * @returns {Promise<void>}
 */
const exportScriptState = async () => {
    if (!confirm('即将导出包含所有素材（音效、BGM、音色）的完整工程文件。如果素材较多，文件可能较大，请耐心等待。')) return;

    isExportingProject.value = true;
    exportStatus.value = '准备中...';
    
    syncCurrentScriptState(); // 确保最新状态

    try {
        // 1. 处理资源库 (嵌入音频文件)
        const processLibrary = async (lib, fileKey) => {
            const processed = [];
            for (let i = 0; i < lib.length; i++) {
                const item = lib[i];
                // 进度提示 & 让出主线程防止卡死
                if (i % 20 === 0) { exportStatus.value = `打包资源 ${Math.round((i / lib.length) * 100)}%`; await new Promise(r => requestAnimationFrame(r)); }

                const itemCopy = { ...item };
                const filename = item[fileKey];
                if (filename) {
                    let blob = null;
                    // 1. 优先从内存 Map 获取 (File 对象)
                    if (localFileMap.value.has(filename)) {
                        blob = localFileMap.value.get(filename);
                    }
                    // 2. 如果内存没有，尝试从 IndexedDB 读取 (Blob)
                    if (!blob) {
                        blob = await loadAssetFromDB(filename);
                    }

                    if (blob) {
                        try {
                            itemCopy._fileData = await blobToBase64(blob);
                            itemCopy._mimeType = blob.type;
                        } catch (e) {
                            console.warn(`Failed to embed file: ${filename}`, e);
                        }
                    }
                }
                processed.push(itemCopy);
            }
            return processed;
        };

        const sfxExport = await processLibrary(sfxLibrary.value, 'filename');
        const bgmExport = await processLibrary(bgmLibrary.value, 'filename');
        const timbreExport = await processLibrary(timbres.value, 'refPath');

        // 导出所有脚本的音频
        const scriptListExport = JSON.parse(JSON.stringify(scriptList.value));
        
        // 遍历所有脚本的所有台词
        for (const script of scriptListExport) {
            const lines = script.data.scriptLines || [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                line.isGenerating = false;

            if (i % 20 === 0) { exportStatus.value = `打包音频...`; await new Promise(r => requestAnimationFrame(r)); }

            // 尝试获取音频 Blob (优先 fetch URL，失败则查 DB)
            let blob = null;
            // 注意：这里 line.audioUrl 在 scriptListExport 中只是字符串，
            // 我们需要去原始 scriptList 中找对应的 blob url，或者直接查 DB
            
            // 简单起见，直接查 DB，因为 audioUrl 可能是 blob: 且不一定在当前页面上下文中有效（如果跨页面）
            // 但这里是在当前页面，所以 blob url 有效。
            // 我们需要找到原始内存中的 line 对象来获取 audioUrl
            const originalScript = scriptList.value.find(s => s.id === script.id);
            const originalLine = originalScript?.data.scriptLines[i];
            
            if (line.audioUrl) {
                try {
                    const res = await fetch(originalLine.audioUrl);
                    blob = await res.blob();
                } catch (e) { /* ignore */ }
            }

            if (!blob && line.type === 'dialogue') {
                blob = await loadAssetFromDB(`line_audio_${line.id}`);
            }

            if (!blob && line.type === 'bgImage') {
                const bgKey = line.bgImageAssetKey || `bgImage_${line.id}`;
                blob = await loadAssetFromDB(bgKey);
            }

            if (blob) {
                try {
                    if (line.type === 'dialogue') {
                        line.audioBase64 = await blobToBase64(blob);
                        line.audioUrl = ''; // 导出时不保存 blob URL
                    } else if (line.type === 'bgImage') {
                        line.imageBase64 = await blobToBase64(blob);
                        line.imageMimeType = blob.type;
                        line.imageUrl = ''; // 导出时不保存 blob URL
                    }
                } catch (e) {
                    console.warn('导出资源失败:', line.id, e);
                }
            }
            }
        }

        exportStatus.value = '生成文件...';
        await new Promise(r => requestAnimationFrame(r));

        const blobParts = [];
        blobParts.push('{\n  "version": "2.0",\n  "timestamp": "' + new Date().toISOString() + '",\n  "libraries": {\n');

        blobParts.push('    "sfx": [');
        for (let i = 0; i < sfxExport.length; i++) {
            blobParts.push(JSON.stringify(sfxExport[i] || null));
            if (i < sfxExport.length - 1) blobParts.push(',');
        }
        blobParts.push('],\n');

        blobParts.push('    "bgm": [');
        for (let i = 0; i < bgmExport.length; i++) {
            blobParts.push(JSON.stringify(bgmExport[i] || null));
            if (i < bgmExport.length - 1) blobParts.push(',');
        }
        blobParts.push('],\n');

        blobParts.push('    "timbres": [');
        for (let i = 0; i < timbreExport.length; i++) {
            blobParts.push(JSON.stringify(timbreExport[i] || null));
            if (i < timbreExport.length - 1) blobParts.push(',');
        }
        blobParts.push('],\n');

        blobParts.push('    "filters": ' + JSON.stringify(filterLibrary.value) + ',\n');
        blobParts.push('    "emotions": ' + JSON.stringify(emotionPresets.value) + '\n  },\n');

        blobParts.push('  "project": {\n');
        blobParts.push('    "characters": ' + JSON.stringify(characters.value) + ',\n');
        
        blobParts.push('    "scriptList": [');
        for (let i = 0; i < scriptListExport.length; i++) {
            blobParts.push('{"id":' + JSON.stringify(scriptListExport[i].id) + ',"name":' + JSON.stringify(scriptListExport[i].name) + ',"data":{');
            blobParts.push('"rawScript":' + JSON.stringify(scriptListExport[i].data.rawScript || '') + ',"rawAnalysisResult":' + JSON.stringify(scriptListExport[i].data.rawAnalysisResult || '') + ',"characters":' + JSON.stringify(scriptListExport[i].data.characters || []) + ',"scriptLines":[');
            
            const lines = scriptListExport[i].data.scriptLines || [];
            for (let j = 0; j < lines.length; j++) {
                blobParts.push(JSON.stringify(lines[j] || null));
                if (j < lines.length - 1) blobParts.push(',');
            }
            
            blobParts.push(']}}');
            if (i < scriptListExport.length - 1) blobParts.push(',');
        }
        blobParts.push('],\n');
        
        blobParts.push('    "currentScriptId": ' + JSON.stringify(currentScriptId.value) + '\n  }\n}');

        const blob = new Blob(blobParts, { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        a.download = `Unitale工程文件_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    } finally {
        isExportingProject.value = false;
        exportStatus.value = '';
    }
};

const triggerImport = () => {
    importFileRef.value.click();
};

/**
 * 导入完整工程文件并恢复本地素材与脚本状态。
 * @param {Event} event - 文件选择事件。
 * @returns {Promise<void>}
 */
const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        isRestoring.value = true; // 导入期间锁定，防止自动保存触发
        isExportingProject.value = true; // 复用 loading 状态
        exportStatus.value = '读取巨型文件中...';

        exportStatus.value = '读取文件中...';
        const text = await file.text();
        exportStatus.value = '提取媒体数据...';

        const extractedBlobs = [];
        
        // 使用正则快速剥离超长 Base64 字符串，避免手动迭代缓慢
        let tinyJsonStr;
        try {
            tinyJsonStr = text.replace(/"(_fileData|audioBase64|imageBase64)":"(data:[^"]+)"/g, (match, key, base64) => {
                extractedBlobs.push(base64);
                return `"${key}":"__EXTRACTED_BASE64_${extractedBlobs.length - 1}__"`;
            });
        } catch (e) {
            console.error('正则替换提取Base64时出错:', e);
            exportStatus.value = `提取失败: ${e.message}`;
            throw e;
        }

        exportStatus.value = '解析结构数据...';
        let data;
        try {
            data = JSON.parse(tinyJsonStr);
        } catch (err) {
            console.error("JSON解析失败:", err);
            const match = err.message.match(/position (\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                console.error("解析出错位置附近内容:", tinyJsonStr.substring(Math.max(0, pos - 50), pos + 50));
            }
            exportStatus.value = `解析失败: ${err.message}`;
            throw err;
        }

            const assetsToSave = []; // 用于批量收集待保存的音频文件

            // 辅助函数：恢复资源库文件
            const restoreLibraryFiles = async (libItems, fileKey) => {
                if (!libItems || !Array.isArray(libItems)) return [];
                const restoredItems = [];
                for (const item of libItems) {
                    if (!item) continue;
                    if (item._fileData) {
                        try {
                            // 如果使用了提取器，拿回真实的 base64 数据
                            let realBase64 = item._fileData;
                            if (realBase64.startsWith('__EXTRACTED_BASE64_')) {
                                const match = realBase64.match(/__EXTRACTED_BASE64_(\d+)__/);
                                if (match) realBase64 = extractedBlobs[parseInt(match[1])];
                            }
                            
                            const blob = base64ToBlob(realBase64, item._mimeType || 'audio/wav');
                            const file = new File([blob], item[fileKey], { type: item._mimeType || 'audio/wav' });
                            localFileMap.value.set(item[fileKey], file);

                            // 优化：收集到批量列表，稍后统一保存
                            assetsToSave.push({ key: item[fileKey], blob: file });

                            // 预加载到缓存
                            loadAudioBuffer(item[fileKey]);

                            delete item._fileData;
                            delete item._mimeType;
                        } catch (err) {
                            console.warn(`Failed to restore file: ${item[fileKey]}`, err);
                        }
                    }
                    restoredItems.push(item);
                }
                return restoredItems;
            };

            if (data.version === '2.0' || data.project) {
                // v2.0 完整工程格式
                if (!confirm('检测到完整工程文件。导入将覆盖当前的【资源库和脚本】（模型配置不会被覆盖）。确定继续吗？')) return;

                // --- 清空当前数据 ---
                rawScript.value = '';
                rawAnalysisResult.value = '';
                characters.value = [];
                scriptLines.value = [];
                scriptList.value = [{ id: 'default', name: '脚本 1', data: { rawScript: '', scriptLines: [], rawAnalysisResult: '', characters: [] } }];
                sfxLibrary.value = [];
                bgmLibrary.value = [];
                timbres.value = [];
                filterLibrary.value = [];
                emotionPresets.value = [];
                localFileMap.value.clear();
                audioBufferCache.clear();

                // 2. 恢复资源库
                if (data.libraries) {
                    sfxLibrary.value = (await restoreLibraryFiles(data.libraries.sfx, 'filename')).map(s => ({ ...s, volume: s.volume ?? 0.3 }));
                    bgmLibrary.value = (await restoreLibraryFiles(data.libraries.bgm, 'filename')).map(b => ({ ...b, volume: b.volume ?? 0.3 }));
                    timbres.value = await restoreLibraryFiles(data.libraries.timbres, 'refPath');
                    filterLibrary.value = data.libraries.filters || [];
                    emotionPresets.value = data.libraries.emotions || [];

                    // 恢复情绪库：合并系统预设 + 导入的自定义情绪
                    if (data.libraries.emotions && Array.isArray(data.libraries.emotions)) {
                        const customImported = data.libraries.emotions.filter(e => !isSystemEmotion(e.name) && Array.isArray(e.vector));
                        const systemImported = data.libraries.emotions.filter(e => isSystemEmotion(e.name));

                        const mergedSystem = SYSTEM_EMOTIONS.map(def => {
                            const imported = systemImported.find(s => s.name === def.name);
                            return { ...def, enabled: imported ? imported.enabled : undefined };
                        });

                        emotionPresets.value = [...mergedSystem, ...customImported];
                    } else {
                        emotionPresets.value = [...SYSTEM_EMOTIONS];
                    }

                    // 不再调用 save*ToLocal，因为数据仅在内存中

                    // 4. 同步音色到服务器
                    try {
                        await syncTimbresWithServer();
                    } catch (e) {
                        console.warn("Timbre sync failed:", e);
                    }
                }

                // 3. 恢复项目状态
                const proj = data.project;
                characters.value = proj.characters || [];
                characters.value.forEach(c => { if (c.volume === undefined) c.volume = 1.0; });

                if (proj.scriptList) {
                    scriptList.value = proj.scriptList;
                    currentScriptId.value = proj.currentScriptId || scriptList.value[0].id;
                } else {
                    // 兼容旧版 v2.0 (如果存在)
                    scriptList.value = [{
                        id: 'default',
                        name: '脚本 1',
                        data: {
                            rawScript: proj.rawScript || '',
                            scriptLines: proj.scriptLines || [],
                            rawAnalysisResult: proj.rawAnalysisResult || '',
                            characters: proj.characters || []
                        }
                    }];
                    currentScriptId.value = 'default';
                }

                // 恢复台词音频
                exportStatus.value = '恢复台词音频...';
                for (const script of scriptList.value) {
                    const lines = script.data.scriptLines || [];
                    for (const line of lines) {
                        if (!line) continue;
                        if (line.audioBase64) {
                            try {
                                let realAudioBase64 = line.audioBase64;
                                if (typeof realAudioBase64 === 'string' && realAudioBase64.startsWith('__EXTRACTED_BASE64_')) {
                                    const match = realAudioBase64.match(/__EXTRACTED_BASE64_(\d+)__/);
                                    if (match) realAudioBase64 = extractedBlobs[parseInt(match[1])];
                                }
                                let blob;
                                if (realAudioBase64.startsWith('data:')) {
                                    const parts = realAudioBase64.split(',');
                                    const mime = parts[0].match(/:(.*?);/)[1];
                                    blob = base64ToBlob(realAudioBase64, mime);
                                } else {
                                    const res = await fetch(realAudioBase64);
                                    blob = await res.blob();
                                }
                                assetsToSave.push({ key: `line_audio_${line.id}`, blob: blob });
                                if (line.speed === undefined) line.speed = 1.0;
                                line.audioUrl = URL.createObjectURL(blob);
                                delete line.audioBase64;
                            } catch (err) { console.warn('Audio restore failed', err); }
                        }
                        if (line.type === 'bgImage' && line.imageBase64) {
                            try {
                                let realImageBase64 = line.imageBase64;
                                if (typeof realImageBase64 === 'string' && realImageBase64.startsWith('__EXTRACTED_BASE64_')) {
                                    const match = realImageBase64.match(/__EXTRACTED_BASE64_(\d+)__/);
                                    if (match) realImageBase64 = extractedBlobs[parseInt(match[1])];
                                }
                                let blob;
                                if (realImageBase64.startsWith('data:')) {
                                    const parts = realImageBase64.split(',');
                                    const mime = parts[0].match(/:(.*?);/)[1];
                                    blob = base64ToBlob(realImageBase64, mime);
                                } else {
                                    const res = await fetch(realImageBase64);
                                    blob = await res.blob();
                                }
                                const bgKey = line.bgImageAssetKey || `bgImage_${line.id}`;
                                line.bgImageAssetKey = bgKey;
                                assetsToSave.push({ key: bgKey, blob: blob });
                                line.imageUrl = URL.createObjectURL(blob);
                                delete line.imageBase64;
                                // imageMimeType 将由 blob.type 自动带入
                            } catch (err) { console.warn('Image restore failed', err); }
                        }
                    }
                }
                
                // 加载当前脚本
                const active = scriptList.value.find(s => s.id === currentScriptId.value);
                if (active) {
                    rawScript.value = active.data.rawScript;
                    scriptLines.value = active.data.scriptLines;
                    rawAnalysisResult.value = active.data.rawAnalysisResult;
                    characters.value = active.data.characters || [];
                    characters.value.forEach(c => { if (c.volume === undefined) c.volume = 1.0; });
                }

                // 执行批量保存 (一次性写入所有文件)
                exportStatus.value = '写入数据库...';
                if (assetsToSave.length > 0) {
                    try {
                        await saveAssetsBatch(assetsToSave);
                    } catch (e) {
                        console.error("Asset save failed:", e);
                        alert("警告：部分音频资源保存到数据库失败（可能是空间不足），刷新页面后可能会丢失音频文件。但脚本和角色设置将尝试保存。");
                    }
                }

                // 强制保存一次项目状态到 DB，确保 JSON 数据也同步
                await saveProjectToDB();

                alert('完整工程导入成功！所有资源和设置已恢复。');

            } else if (data.scriptLines && Array.isArray(data.scriptLines)) {
                // v1.x 旧版存档格式兼容
                if (confirm('检测到旧版存档。确定要读取吗？当前未保存的进度将被覆盖。')) {
                    // 修复：先清空角色列表，防止残留
                    characters.value = [];

                    if (data.rawScript !== undefined) rawScript.value = data.rawScript;
                    if (data.rawAnalysisResult !== undefined) rawAnalysisResult.value = data.rawAnalysisResult;

                    // 修复：读取存档时，如果存档包含角色列表则直接使用，否则根据台词重建角色列表
                    // 这样可以确保“没有的角色要删除”，并且“角色的音色选用也要保存”
                    if (data.characters && Array.isArray(data.characters)) {
                        characters.value = data.characters;
                        characters.value.forEach(c => { if (c.volume === undefined) c.volume = 1.0; });
                    } else {
                        // 兼容旧存档：从台词中提取角色
                        const roles = new Set();
                        data.scriptLines.forEach(l => {
                            if (l.type === 'dialogue' && l.role) roles.add(l.role);
                        });
                        characters.value = Array.from(roles).map(r => {
                            const matchingTimbre = timbres.value.find(t => t.name === r);
                            return {
                                id: Date.now() + Math.random().toString(),
                                name: r,
                                voiceFile: matchingTimbre ? matchingTimbre.refPath : '',
                                volume: 1.0
                            };
                        });
                    }

                    // 恢复音频数据 (Base64 -> Blob URL)
                    exportStatus.value = '恢复旧版数据...';
                    
                    // 初始化脚本列表
                    scriptList.value = [{
                        id: 'default',
                        name: '脚本 1',
                        data: { rawScript: rawScript.value, scriptLines: [], rawAnalysisResult: rawAnalysisResult.value }
                    }];
                    currentScriptId.value = 'default';
                    const activeScriptData = scriptList.value[0].data;
                    const restoredLines = [];

                    for (const line of data.scriptLines) {
                        // 兼容性修复：确保必要字段存在
                        if (!line.id) line.id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
                        if (!line.type) line.type = 'dialogue';
                        if (line.trimStart === undefined) line.trimStart = 0;
                        if (line.trimEnd === undefined) line.trimEnd = 1;
                        if (line.speed === undefined) line.speed = 1.0;
                        
                        // 兼容旧版音量字段
                        if (line.type === 'dialogue') {
                            if (line.dialogueVolume === undefined && line.volume !== undefined) line.dialogueVolume = line.volume;
                            if (line.dialogueVolume === undefined) line.dialogueVolume = 1.0;
                        }

                        if (line.audioBase64) {
                            try {
                                const res = await fetch(line.audioBase64);
                                const blob = await res.blob();

                                // 优化：收集到批量列表
                                assetsToSave.push({ key: `line_audio_${line.id}`, blob: blob });

                                line.audioUrl = URL.createObjectURL(blob);
                                // delete line.audioBase64; // 可选：释放内存，但保留在对象中也没关系
                            } catch (err) {
                                console.warn('恢复音频失败:', line.id, err);
                            }
                        }
                        restoredLines.push(line);
                    }

                    activeScriptData.scriptLines = restoredLines;
                    scriptLines.value = restoredLines; // Sync to view

                    exportStatus.value = '保存中...';
                    if (assetsToSave.length > 0) {
                        try {
                            await saveAssetsBatch(assetsToSave);
                        } catch (e) {
                            console.error("Asset save failed:", e);
                        }
                    }
                    await saveProjectToDB();
                    alert('存档读取成功！');
                }
            } else {
                alert('无效的存档文件格式');
            }
        } catch (err) {
            console.error('导入工程失败:', err);
            exportStatus.value = `导入失败: ${err.message}`;
            alert(`导入失败: ${err.message}\n请打开控制台查看详细报错。`);
        } finally {
            isExportingProject.value = false;
            exportStatus.value = '';
        }
        event.target.value = ''; // Reset
};

const triggerImportTxt = () => {
    importTxtRef.value.click();
};

const handleImportTxt = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        rawScript.value = e.target.result;
    };
    reader.readAsText(file);
    event.target.value = '';
};

// ==================== Audio & Subtitle Export ====================

/**
 * 按当前脚本时间轴离线混音并导出 WAV 文件。
 * @returns {Promise<void>}
 */
const exportAudio = async () => {
    const dialogueLines = scriptLines.value.filter(l => l.type === 'dialogue');
    if (dialogueLines.length === 0) return alert('脚本为空');
    if (dialogueLines.some(l => !l.audioUrl)) {
        if (!confirm('部分台词尚未生成音频，导出时将被跳过。确定继续吗？')) return;
    }

    isExportingAudio.value = true;

    try {
        const assets = { dialogues: {}, sfx: {}, bgm: {} };

        // 1. 加载所有台词音频
        for (const line of dialogueLines) {
            if (line.audioUrl) assets.dialogues[line.id] = await loadAudioBuffer(line.audioUrl);
        }

        // 2. 加载用到的音效
        const usedSfxNames = new Set();
        scriptLines.value.forEach(l => { if (l.sfx) l.sfx.forEach(s => usedSfxNames.add(s.name)); });
        for (const name of usedSfxNames) {
            const item = sfxLibrary.value.find(s => s.name === name);
            if (item && item.filename) {
                try { assets.sfx[name] = await loadAudioBuffer(item.filename); } catch (e) { }
            }
        }

        // 3. 加载用到的 BGM
        const usedBgmNames = new Set();
        scriptLines.value.forEach(l => { if (l.type === 'bgm' && l.action === 'play') usedBgmNames.add(l.bgmName); });
        for (const name of usedBgmNames) {
            const item = bgmLibrary.value.find(b => b.name === name);
            if (item && item.filename) {
                try { assets.bgm[name] = await loadAudioBuffer(item.filename); } catch (e) { }
            }
        }

        // 4. 计算时间轴
        let currentTime = 0;
        const events = [];
        const bgmSegments = [];
        let currentBgm = null;

        for (const line of scriptLines.value) {
            if (line.type === 'bgm') {
                if (line.action === 'play') {
                    if (currentBgm) bgmSegments.push({ ...currentBgm, end: currentTime });
                    currentBgm = { name: line.bgmName, start: currentTime, volume: line.volume };
                } else if (line.action === 'stop') {
                    if (currentBgm) {
                        bgmSegments.push({ ...currentBgm, end: currentTime });
                        currentBgm = null;
                    }
                }
            } else if (line.type === 'dialogue') {
                const buffer = assets.dialogues[line.id];
                if (buffer) {
                    // 计算剪辑
                    const trimStart = line.trimStart || 0;
                    const trimEnd = line.trimEnd || 1;
                    const playDuration = buffer.duration * (trimEnd - trimStart);
                    const speed = line.speed || 1.0;
                    const effectiveDuration = playDuration / speed;

                    // 模拟 playLineAudio 中的 0.05s 调度延迟，确保导出节奏与实时播放一致
                    currentTime += 0.05;
                    events.push({ type: 'dialogue', time: currentTime, buffer: buffer, line: line, trimStart, trimEnd, playDuration, speed });
                    currentTime += effectiveDuration;
                }
                currentTime += (line.break_duration || 0);
            }
        }
        if (currentBgm) bgmSegments.push({ ...currentBgm, end: currentTime + 2 }); // BGM 尾部淡出

        // 5. 离线渲染
        const totalDuration = currentTime + 1;
        const offlineCtx = new OfflineAudioContext(2, totalDuration * 44100, 44100);

        // 调度 BGM
        bgmSegments.forEach(seg => {
            const buffer = assets.bgm[seg.name];
            if (buffer) {
                const libItem = bgmLibrary.value.find(b => b.name === seg.name);
                const libVol = libItem ? (libItem.volume ?? 1.0) : 1.0;
                const finalVol = seg.volume * libVol;

                const src = offlineCtx.createBufferSource();
                src.buffer = buffer;
                src.loop = true;
                const trimStart = libItem?.trimStart ?? 0;
                const trimEnd = libItem?.trimEnd ?? 1;
                src.loopStart = buffer.duration * trimStart;
                src.loopEnd = buffer.duration * trimEnd;

                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0, seg.start);
                gain.gain.linearRampToValueAtTime(finalVol, seg.start + 2);
                gain.gain.setValueAtTime(finalVol, Math.max(seg.start + 2, seg.end - 2));
                gain.gain.linearRampToValueAtTime(0, seg.end);
                src.connect(gain).connect(offlineCtx.destination);
                src.start(seg.start, src.loopStart); // Start from loop start
                src.stop(seg.end);
            }
        });

        // 调度台词和音效
        events.forEach(evt => {
            const dSrc = offlineCtx.createBufferSource();
            dSrc.buffer = evt.buffer;
            dSrc.playbackRate.value = evt.speed;
            const dGain = offlineCtx.createGain();
            const char = characters.value.find(c => c.name === evt.line.role);
            const charVol = char ? (char.volume ?? 1.0) : 1.0;
            dGain.gain.value = (evt.line.dialogueVolume ?? 1.0) * charVol;

            const offset = evt.buffer.duration * evt.trimStart;
            const duration = evt.playDuration;

            let lastNode = dSrc;
            // 应用滤镜
            if (evt.line.filter) {
                const fConfig = filterLibrary.value.find(f => f.name === evt.line.filter);
                if (fConfig) {
                    if (fConfig.type === 'distortion') {
                        const ws = offlineCtx.createWaveShaper();
                        ws.curve = makeDistortionCurve(fConfig.gain);
                        ws.oversample = '4x';
                        lastNode.connect(ws);
                        lastNode = ws;
                    } else {
                        const bq = offlineCtx.createBiquadFilter();
                        bq.type = fConfig.type;
                        bq.frequency.value = fConfig.frequency;
                        bq.Q.value = fConfig.Q;
                        lastNode.connect(bq);
                        lastNode = bq;
                    }
                }
            }
            lastNode.connect(dGain).connect(offlineCtx.destination);
            dSrc.start(evt.time, offset, duration);

            // 调度音效
            if (evt.line.sfx) {
                evt.line.sfx.forEach(s => {
                    const sBuffer = assets.sfx[s.name];
                    if (sBuffer) {
                        const originalDuration = evt.buffer.duration;
                        const absStart = originalDuration * evt.trimStart;
                        const absEnd = originalDuration * evt.trimEnd;
                        const trimmedDuration = absEnd - absStart;
                        const pos = parseFloat(s.position) || 0;
                        // 修正：位置应该是相对于裁剪后的时长
                        const absSfxTime = absStart + (trimmedDuration * pos);

                        if (absSfxTime >= absStart && absSfxTime <= absEnd) {
                            const sSrc = offlineCtx.createBufferSource();
                            sSrc.buffer = sBuffer;
                            const sGain = offlineCtx.createGain();
                            const libItem = sfxLibrary.value.find(l => l.name === s.name);
                            const libVol = libItem ? (libItem.volume ?? 1.0) : 1.0;
                            const scriptVol = evt.line.sfxVolume ?? 0.5;
                            sGain.gain.value = scriptVol * libVol;

                            const sTrimStart = libItem?.trimStart ?? 0;
                            const sTrimEnd = libItem?.trimEnd ?? 1;
                            const sOffset = sBuffer.duration * sTrimStart;
                            const sDuration = sBuffer.duration * (sTrimEnd - sTrimStart);

                            sSrc.connect(sGain).connect(offlineCtx.destination);

                            const relativeStart = absSfxTime - absStart;
                            sSrc.start(evt.time + relativeStart / evt.speed, sOffset, sDuration);
                        }
                    }
                });
            }
        });

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storyforge_export_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        console.error(e);
        alert('导出失败: ' + e.message);
    } finally {
        isExportingAudio.value = false;
    }
};

/**
 * 根据当前台词时间轴导出 SRT 字幕文件。
 * @returns {Promise<void>}
 */
const exportSRT = async () => {
    const dialogueLines = scriptLines.value.filter(l => l.type === 'dialogue');
    if (dialogueLines.length === 0) return alert('脚本为空');

    if (dialogueLines.some(l => !l.audioUrl)) {
        if (!confirm('部分台词尚未生成音频，导出字幕时时间轴可能不准确（将跳过未生成音频的行）。确定继续吗？')) return;
    }

    isExportingAudio.value = true; // 复用 loading 状态

    try {
        // 1. 加载所有台词音频以获取时长
        const audioMap = new Map();
        const loadPromises = dialogueLines.map(async (line) => {
            if (line.audioUrl) {
                const buffer = await loadAudioBuffer(line.audioUrl);
                if (buffer) audioMap.set(line.id, buffer);
            }
        });
        await Promise.all(loadPromises);

        let srtContent = '';
        let currentTime = 0;
        let counter = 1;

        const formatTime = (seconds) => {
            const date = new Date(0);
            date.setMilliseconds(seconds * 1000);
            const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
            const mm = String(date.getUTCMinutes()).padStart(2, '0');
            const ss = String(date.getUTCSeconds()).padStart(2, '0');
            const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
            return `${hh}:${mm}:${ss},${ms}`;
        };

        // 辅助函数：智能切割长字幕
        const splitLongText = (text) => {
            if (!text) return [];

            // 1. 去除句末的逗号和句号 (保留问号感叹号等)
            let processed = text.replace(/[，。,.]\s*$/, '');

            // 2. 如果文本较短，直接返回
            if (processed.length <= 25) return [processed];

            // 3. 优先按标点符号切割
            // 句号(。)和点(.)：作为分隔符消耗掉 (不保留在句末)
            // 问号、感叹号等：保留在上一句
            // 逗号：不作为主分隔符，保留在句中 (除非后续长度强制切割)
            const parts = processed.split(/[。.]\s*|(?<=[！？；：!?])\s*/).filter(p => p.trim().length > 0);

            const finalParts = [];
            for (const p of parts) {
                // 3. 如果切割后的片段依然过长 (> 30字符)，强制按长度再次切割
                if (p.length > 30) {
                    let remaining = p;
                    while (remaining.length > 0) {
                        let cutIndex = 25;
                        if (remaining.length <= 25) {
                            cutIndex = remaining.length;
                        }
                        else {
                            // 尝试在逗号或空格处断句
                            // 优先找逗号
                            const lastComma = Math.max(remaining.lastIndexOf('，', 25), remaining.lastIndexOf(',', 25));
                            const lastSpace = remaining.lastIndexOf(' ', 25);

                            if (lastComma > 10) {
                                cutIndex = lastComma; // 切在逗号处 (逗号会被丢弃)
                            } else if (lastSpace > 10) {
                                cutIndex = lastSpace;
                            }
                        }
                        finalParts.push(remaining.substring(0, cutIndex).trim());

                        // 如果是在逗号处切的，要跳过这个逗号
                        if (remaining[cutIndex] === '，' || remaining[cutIndex] === ',') {
                            remaining = remaining.substring(cutIndex + 1).trim();
                        } else {
                            remaining = remaining.substring(cutIndex).trim();
                        }
                    }
                } else {
                    finalParts.push(p);
                }
            }
            return finalParts;
        };

        for (const line of scriptLines.value) {
            if (line.type === 'dialogue') {
                const buffer = audioMap.get(line.id);
                if (buffer) {
                    const trimStart = line.trimStart || 0;
                    const trimEnd = line.trimEnd || 1;
                    const duration = buffer.duration * (trimEnd - trimStart);
                    const totalDuration = duration / (line.speed || 1.0);

                    const startTime = currentTime + 0.05; // 对应 exportAudio 的 0.05s 偏移

                    // 获取切割后的字幕片段
                    const textSegments = splitLongText(line.text);
                    const totalLength = textSegments.reduce((acc, cur) => acc + cur.length, 0);

                    let segmentStartTime = startTime;

                    if (totalLength > 0) {
                        for (const segment of textSegments) {
                            // 按字符长度比例分配时间
                            const segmentRatio = segment.length / totalLength;
                            const segmentDuration = totalDuration * segmentRatio;
                            const segmentEndTime = segmentStartTime + segmentDuration;

                            srtContent += `${counter}\n`;
                            srtContent += `${formatTime(segmentStartTime)} --> ${formatTime(segmentEndTime)}\n`;
                            srtContent += `${segment}\n\n`;

                            counter++;
                            segmentStartTime = segmentEndTime;
                        }
                    }

                    currentTime = startTime + totalDuration;
                }
                currentTime += (line.break_duration || 0);
            }
        }

        const blob = new Blob([srtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Unitale字幕文件_${Date.now()}.srt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert('导出SRT失败: ' + e.message);
    } finally {
        isExportingAudio.value = false;
    }
};

// ==================== Script Authoring ====================

const splitScript = () => {
    if (!rawScript.value.trim()) return alert('请输入原文内容');

    let text = rawScript.value.replace(/\r\n/g, '\n');
    const splitRegex = /\n+|(?<=[。！？!?])(?=["']?)\s*/;

    const lines = text.split(splitRegex)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    scriptLines.value = lines.map(text => ({
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'dialogue',
        role: '旁白',
        emotion: '平静',
        intensity: '中等',
        filter: '',
        text: text,
        trimStart: 0,
        trimEnd: 1,
        sfxVolume: 1.0,
        dialogueVolume: 1.0,
        speed: 1.0,
        audioUrl: '',
        isGenerating: false
    }));
};

const addBgmBlock = () => {
    const newBlock = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'bgm',
        action: 'play',
        volume: 1.0,
        bgmName: bgmLibrary.value.length > 0 ? bgmLibrary.value[0].name : ''
    };
    if (selectedLineIndex.value !== -1 && selectedLineIndex.value < scriptLines.value.length) {
        scriptLines.value.splice(selectedLineIndex.value + 1, 0, newBlock);
        selectedLineIndex.value++;
    } else {
        scriptLines.value.push(newBlock);
        selectedLineIndex.value = scriptLines.value.length - 1;
    }
};

const addBgImageBlock = () => {
    const newId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    const newBlock = {
        id: newId,
        type: 'bgImage',
        bgImagePrompt: '',
        // selected background will be saved into assets store and restored via bgImageAssetKey
        bgImageAssetKey: '',
        imageUrl: ''
    };
    if (selectedLineIndex.value !== -1 && selectedLineIndex.value < scriptLines.value.length) {
        scriptLines.value.splice(selectedLineIndex.value + 1, 0, newBlock);
        selectedLineIndex.value++;
    } else {
        scriptLines.value.push(newBlock);
        selectedLineIndex.value = scriptLines.value.length - 1;
    }
};

const addDialogueBlock = () => {
    const newBlock = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'dialogue',
        role: '旁白',
        emotion: '平静',
        intensity: '中等',
        filter: '',
        text: '',
        trimStart: 0,
        trimEnd: 1,
        sfx: [],
        break_duration: 0,
        sfxVolume: 1.0,
        dialogueVolume: 1.0,
        speed: 1.0,
        audioUrl: '',
        isGenerating: false
    };
    if (selectedLineIndex.value !== -1 && selectedLineIndex.value < scriptLines.value.length) {
        scriptLines.value.splice(selectedLineIndex.value + 1, 0, newBlock);
        selectedLineIndex.value++;
    } else {
        scriptLines.value.push(newBlock);
        selectedLineIndex.value = scriptLines.value.length - 1;
    }
};

const removeScriptLine = (index) => {
    scriptLines.value.splice(index, 1);
    if (selectedLineIndex.value === index) {
        selectedLineIndex.value = -1;
    } else if (selectedLineIndex.value > index) {
        selectedLineIndex.value--;
    }
};

const openBgImagePicker = (lineIndex) => {
    pendingBgImageLineIndex.value = lineIndex;
    if (bgImagePickerRef.value) bgImagePickerRef.value.click();
};

const handleBgImageFileChange = async (event) => {
    const file = event.target.files && event.target.files[0];
    const lineIndex = pendingBgImageLineIndex.value;
    pendingBgImageLineIndex.value = -1;
    event.target.value = '';
    if (!file) return;

    const line = scriptLines.value[lineIndex];
    if (!line || line.type !== 'bgImage') return;

    const assetKey = line.bgImageAssetKey || `bgImage_${line.id}`;
    line.bgImageAssetKey = assetKey;
    line.imageUrl = URL.createObjectURL(file);

    try {
        await saveAssetToDB(assetKey, file);
    } catch (e) {
        console.error('Failed to save bgImage asset:', e);
        alert('保存背景图片失败，请重试。');
    }

    triggerAutoSave();
};

const copyBgImagePrompt = async (line) => {
    const text = line?.bgImagePrompt || '';
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        alert('已复制背景图片提示词');
    } catch (e) {
        // Fallback for environments without clipboard permission
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('已复制背景图片提示词');
    }
};

const autoResizeTextarea = (event) => {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
};

const addLineSfx = (line) => {
    if (!line.sfx) line.sfx = [];
    const defaultSfx = sfxLibrary.value.length > 0 ? sfxLibrary.value[0].name : 'New SFX';
    line.sfx.push({ name: defaultSfx, position: 0.5 });
};

const removeLineSfx = (line, index) => {
    if (line.sfx) line.sfx.splice(index, 1);
};

const stopScriptSequentially = () => {
    isSequencePlaying.value = false;
    currentSequenceIndex.value = -1;
    if (!isGeneratingVideo.value) stageBgUrl.value = '';
    stageBgFadePrevUrl.value = '';
    stageBgFadeStartTs.value = 0;
    // Stop dialogue audio
    if (dialogueSource) {
        try { dialogueSource.stop(); } catch (e) { }
        dialogueSource = null;
    }
    // Stop SFX audio
    sfxSources.forEach(source => { try { source.stop(); } catch (e) { } });
    sfxSources = [];
    // Stop BGM audio
    if (bgmAudioNode && bgmGainNode) {
        const oldNode = bgmAudioNode;
        const oldGain = bgmGainNode;
        const now = audioContext.currentTime;
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0, now + 2);
        setTimeout(() => { try { oldNode.stop(); } catch (e) { } }, 2000);
        bgmAudioNode = null;
        bgmGainNode = null;
    }
};

/**
 * 播放或切换背景音乐，并处理前一段 BGM 的淡出。
 * @param {string} bgmName - 背景音乐名称。
 * @param {number} [volume=0.4] - 脚本层指定的目标音量。
 * @returns {Promise<void>}
 */
const playBgm = async (bgmName, volume = 0.4) => {
    // Stop any existing BGM
    if (bgmAudioNode && bgmGainNode) {
        const oldNode = bgmAudioNode;
        const oldGain = bgmGainNode;
        const now = audioContext.currentTime;

        // 淡出旧 BGM
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.linearRampToValueAtTime(0, now + 2);

        setTimeout(() => {
            try { oldNode.stop(); } catch (e) { }
        }, 2000);

        bgmAudioNode = null;
        bgmGainNode = null;
    }

    const bgmLibItem = bgmLibrary.value.find(b => b.name === bgmName);
    if (!bgmLibItem || !bgmLibItem.filename) {
        console.warn(`BGM not found in library: ${bgmName}`);
        return;
    }

    try {
        const audioBuffer = await loadAudioBuffer(bgmLibItem.filename);
        if (!audioBuffer) throw new Error('Load failed');

        bgmAudioNode = audioContext.createBufferSource();
        bgmAudioNode.buffer = audioBuffer;
        bgmAudioNode.loop = true;
        bgmAudioNode.loopStart = audioBuffer.duration * (bgmLibItem.trimStart ?? 0);
        bgmAudioNode.loopEnd = audioBuffer.duration * (bgmLibItem.trimEnd ?? 1);

        bgmGainNode = audioContext.createGain();
        // 淡入新 BGM
        const libVolume = bgmLibItem.volume ?? 1.0;
        const finalVolume = volume * libVolume;
        bgmGainNode.gain.value = 0;
        bgmGainNode.gain.linearRampToValueAtTime(finalVolume, audioContext.currentTime + 2);

        bgmAudioNode.connect(bgmGainNode).connect(getAudioOutputNode());
        bgmAudioNode.start(0, bgmAudioNode.loopStart);
    } catch (e) {
        console.error(`Failed to load or play BGM ${bgmLibItem.filename}:`, e);
        alert(`播放背景音乐失败: ${bgmLibItem.filename}`);
    }
};

/**
 * 从当前选中位置顺序播放整段脚本。
 * @returns {Promise<void>}
 */
const playScriptSequentially = async () => {
    stopScriptSequentially();
    isSequencePlaying.value = true;
    const startIndex = selectedLineIndex.value !== -1 ? selectedLineIndex.value : 0;

    // --- bgImage Pre-scan Logic ---
    if (startIndex > 0) {
        let lastBgImageLine = null;
        for (let i = startIndex - 1; i >= 0; i--) {
            const line = scriptLines.value[i];
            if (line.type === 'bgImage') {
                lastBgImageLine = line;
                break;
            }
        }
        if (lastBgImageLine && lastBgImageLine.imageUrl) {
            setStageBgUrlWithFade(lastBgImageLine.imageUrl);
        }
    } else {
        // 兜底：从开头播放但之前没有 bgImage，则尝试使用第一个 bgImage 作为开场背景
        const firstBgImageLine = scriptLines.value.find(l => l.type === 'bgImage');
        if (firstBgImageLine && firstBgImageLine.imageUrl) {
            setStageBgUrlWithFade(firstBgImageLine.imageUrl);
        }
    }
    // --- End bgImage Pre-scan ---

    // --- BGM Pre-scan Logic ---
    if (startIndex > 0) {
        // Find the last BGM directive before the start index.
        let lastBgmLine = null;
        for (let i = startIndex - 1; i >= 0; i--) {
            const line = scriptLines.value[i];
            if (line.type === 'bgm') {
                lastBgmLine = line;
                break; // Found the last one, no need to look further back.
            }
        }

        // If the last directive was to play a BGM, play it now.
        // If it was 'stop' or null, we do nothing, as stopScriptSequentially() already handled it.
        if (lastBgmLine && lastBgmLine.action === 'play') {
            await playBgm(lastBgmLine.bgmName, lastBgmLine.volume);
        }
    }
    // --- End BGM Pre-scan ---

    for (let i = startIndex; i < scriptLines.value.length; i++) {
        if (!isSequencePlaying.value) break; // Check if stopped

        currentSequenceIndex.value = i;

        // Scroll into view manually to prevent page scroll
        const container = scriptListContainer.value;
        const child = lineRefs.value[i];

        if (container && child) {
            const containerRect = container.getBoundingClientRect();
            const childRect = child.getBoundingClientRect();

            // The offset of the child relative to the container's top edge
            const childOffsetTop = childRect.top - containerRect.top;
            
            // The desired scrollTop to center the child
            const newScrollTop = container.scrollTop + childOffsetTop - (container.clientHeight / 2) + (child.clientHeight / 2);

            container.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
            });
        }

        const line = scriptLines.value[i];

        if (line.type === 'bgm') {
            if (line.action === 'play') {
                await playBgm(line.bgmName, line.volume);
            } else if (line.action === 'stop') {
                if (bgmAudioNode && bgmGainNode) {
                    const oldNode = bgmAudioNode;
                    const oldGain = bgmGainNode;
                    const now = audioContext.currentTime;
                    oldGain.gain.cancelScheduledValues(now);
                    oldGain.gain.setValueAtTime(oldGain.gain.value, now);
                    oldGain.gain.linearRampToValueAtTime(0, now + 2);
                    setTimeout(() => { try { oldNode.stop(); } catch (e) { } }, 2000);
                    bgmAudioNode = null;
                    bgmGainNode = null;
                }
            }
        } else if (line.type === 'bgImage') {
            setStageBgUrlWithFade(line.imageUrl || '');
        } else { // 'dialogue'
            if (!line.audioUrl) {
                // 跳过未生成的台词
                continue;
            }

            // A promise that resolves when the line finishes playing
            await playLineAudio(line, false);

            if (!isSequencePlaying.value) break;

            // Handle break duration
            if (line.break_duration > 0) {
                await new Promise(resolve => setTimeout(resolve, line.break_duration * 1000));
            }
        }
    }

    // Reset when done or stopped
    stopScriptSequentially();
};

// ==================== Video Export ====================

/**
 * 基于当前脚本、音频与背景图时间轴导出 MP4 视频。
 * @returns {Promise<void>}
 */
const generateVideo = async () => {
    const dialogueLines = scriptLines.value.filter(l => l.type === 'dialogue');
    if (dialogueLines.length === 0) return alert('脚本为空');

    if (dialogueLines.some(l => !l.audioUrl)) {
        if (!confirm('部分台词尚未生成音频，导出视频时将跳过未生成的台词。确定继续吗？')) return;
    }

    if (typeof VideoEncoder === 'undefined') {
        return alert('当前浏览器不支持 WebCodecs API，无法快速导出视频。请使用最新版 Chrome 或 Edge。');
    }
    if (typeof Mp4Muxer === 'undefined') {
        return alert('缺少 Mp4Muxer 库，无法导出 MP4。');
    }

    isGeneratingVideo.value = true;
    exportStatus.value = '准备素材...';

    try {
        const assets = { dialogues: {} };

        // 1. 加载所有台词音频
        for (const line of dialogueLines) {
            if (line.audioUrl) assets.dialogues[line.id] = await loadAudioBuffer(line.audioUrl);
        }

        // 2. 加载背景图片
        const bgUrls = Array.from(new Set(
            scriptLines.value.filter(l => l.type === 'bgImage' && l.imageUrl).map(l => l.imageUrl)
        ));
        const bgImageCache = new Map();
        for (const url of bgUrls) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                img.src = url;
            });
            bgImageCache.set(url, img);
        }

        // 3. 用与音频导出一致的时长规则计算视频时间轴
        let currentTime = 0;
        const visualTimeline = [];
        let currentBgUrl = '';
        let lastBgChangeTime = 0;

        // 初始化首个背景
        const firstBgLine = scriptLines.value.find(l => l.type === 'bgImage' && l.imageUrl);
        if (firstBgLine) currentBgUrl = firstBgLine.imageUrl;

        for (const line of scriptLines.value) {
            if (line.type === 'bgImage') {
                if (line.imageUrl && line.imageUrl !== currentBgUrl) {
                    if (currentTime > lastBgChangeTime) {
                        visualTimeline.push({
                            url: currentBgUrl,
                            start: lastBgChangeTime,
                            end: currentTime
                        });
                    }
                    currentBgUrl = line.imageUrl;
                    lastBgChangeTime = currentTime;
                }
            } else if (line.type === 'dialogue') {
                const buffer = assets.dialogues[line.id];
                if (buffer) {
                    const trimStart = line.trimStart || 0;
                    const trimEnd = line.trimEnd || 1;
                    const playDuration = buffer.duration * (trimEnd - trimStart);
                    const speed = line.speed || 1.0;
                    const effectiveDuration = playDuration / speed;

                    currentTime += 0.05;
                    currentTime += effectiveDuration;
                }
                currentTime += (line.break_duration || 0);
            }
        }
        if (currentTime > lastBgChangeTime) {
            visualTimeline.push({
                url: currentBgUrl,
                start: lastBgChangeTime,
                end: currentTime
            });
        }

        exportStatus.value = '生成视频轨道...';
        
        const fps = 4;
        const tailPaddingSec = 1 + (1 / fps) + 0.02; // 额外补 1 帧 + 微小保护量，避免导入剪辑软件时尾部被吃掉
        const totalDuration = currentTime + tailPaddingSec;
        let [width, height] = videoResolution.value.split('x').map(Number);
        
        // Ensure width and height are even numbers (required by many hardware encoders)
        width = width % 2 === 0 ? width : width + 1;
        height = height % 2 === 0 ? height : height + 1;
        
        const muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: { codec: 'avc', width, height },
            fastStart: 'in-memory'
        });

        let videoEncoder;

        const encodeErrorPromise = new Promise((_, reject) => {
            videoEncoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: e => { 
                    console.error('VideoEncoder error:', e); 
                    reject(new Error('视频编码错误: ' + e.message)); 
                }
            });

        });

        // Dynamically choose codec profile based on resolution.                        // 1080p (1920x1080 or 1080x1920) typically needs Level 4.2 (avc1.64002A) or Level 4.0.
        let codecString = 'avc1.4d002a'; // Main Profile，静态高清图更不容易出马赛克
        
        const config = {
            codec: codecString,
            width, height,
            bitrate: 3_000_000,
            framerate: fps,
            hardwareAcceleration: "prefer-hardware"
        };

        try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (!support.supported) {
                console.warn("Video configuration not supported by hardware, trying software/baseline fallback...");
                config.codec = 'avc1.42002a'; // Fallback to Baseline Profile Level 4.2
                config.hardwareAcceleration = "no-preference";
                
                const fallbackSupport = await VideoEncoder.isConfigSupported(config);
                if (!fallbackSupport.supported) {
                    // Extreme fallback
                    config.codec = 'avc1.42001f'; // Baseline 3.1
                }
            }
        } catch (e) {
            console.warn("Failed to check video config support, using default", e);
            config.codec = 'avc1.42002a'; // Fallback to Baseline Profile Level 4.2 on error
            config.hardwareAcceleration = "no-preference";
        }

        videoEncoder.configure(config);

        // Yield to the event loop to allow the encoders' configuration tasks to complete.
        await new Promise(r => setTimeout(r, 0));

        const renderVideoPromise = async () => {
            const offscreenCanvas = new OffscreenCanvas(width, height);
            const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
            offscreenCtx.imageSmoothingEnabled = true;
            offscreenCtx.imageSmoothingQuality = 'high';
            const drawCover = (ctx, img, cw, ch) => {
                const scale = Math.max(cw / img.width, ch / img.height);
                const dw = img.width * scale;
                const dh = img.height * scale;
                const dx = (cw - dw) / 2;
                const dy = (ch - dh) / 2;
                ctx.drawImage(img, dx, dy, dw, dh);
            };

            const segments = visualTimeline
                .filter(stage => stage && stage.end > stage.start)
                .map((stage, index, arr) => {
                    const stageEnd = index === arr.length - 1 ? totalDuration : stage.end;
                    return {
                        url: stage.url || '',
                        startUs: Math.round(stage.start * 1000000),
                        durationUs: Math.max(1, Math.round((stageEnd - stage.start) * 1000000))
                    };
                });

            if (segments.length === 0) {
                segments.push({
                    url: '',
                    startUs: 0,
                    durationUs: Math.max(1, Math.round(totalDuration * 1000000))
                });
            }

            const frameDurationUs = Math.round(1000000 / fps);
            const totalFrames = segments.reduce((sum, stage) => {
                return sum + Math.max(1, Math.ceil(stage.durationUs / frameDurationUs));
            }, 0);
            let encodedFrames = 0;

            for (let i = 0; i < segments.length; i++) {
                const stage = segments[i];
                const currentUrl = stage.url;

                offscreenCtx.fillStyle = '#000';
                offscreenCtx.fillRect(0, 0, width, height);

                if (currentUrl && bgImageCache.has(currentUrl)) {
                    const img = bgImageCache.get(currentUrl);
                    drawCover(offscreenCtx, img, width, height);
                }

                while (videoEncoder.encodeQueueSize > 30) {
                    if (videoEncoder.state !== 'configured') {
                        break;
                    }
                    await new Promise(r => setTimeout(r, 10));
                }
                
                const stageFrames = Math.max(1, Math.ceil(stage.durationUs / frameDurationUs));
                for (let frameIndex = 0; frameIndex < stageFrames; frameIndex++) {
                    const frameStartUs = stage.startUs + (frameIndex * frameDurationUs);
                    const isLastFrame = frameIndex === stageFrames - 1;
                    const durationUs = isLastFrame
                        ? Math.max(1, stage.durationUs - (frameIndex * frameDurationUs))
                        : frameDurationUs;

                    const frame = new VideoFrame(offscreenCanvas, {
                        timestamp: frameStartUs,
                        duration: durationUs
                    });
                    if (videoEncoder.state !== 'configured') {
                        frame.close();
                        throw new Error('视频编码器状态异常 (' + videoEncoder.state + ')。可能是分辨率或编码配置不受当前浏览器支持。');
                    }
                    videoEncoder.encode(frame, { keyFrame: frameIndex === 0 });
                    frame.close();
                    encodedFrames++;
                }

                exportStatus.value = `编码视频 ${Math.round((encodedFrames / totalFrames) * 100)}%`;
                await new Promise(r => setTimeout(r, 0));
            }
            
            if (videoEncoder.state === 'configured') {
                await videoEncoder.flush();
                videoEncoder.close();
            }
        };

        // 运行编码并捕获任何可能发生的抛错
        await Promise.race([
            renderVideoPromise(),
            encodeErrorPromise
        ]);

        exportStatus.value = '封装 MP4...';
        muxer.finalize();
        const mp4Buffer = muxer.target.buffer;
        const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Unitale_导出视频_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        console.error('Video generation failed:', e);
        alert('导出视频失败: ' + e.message);
    } finally {
        isGeneratingVideo.value = false;
        exportStatus.value = '';
    }
};



/**
 * 调用 LLM 分析原文并生成可编辑的脚本结构。
 * @returns {Promise<void>}
 */
const analyzeScript = async () => {
    if (isAnalyzingScript.value) {
        if (analysisAbortController.value) analysisAbortController.value.abort();
        isAnalyzingScript.value = false;
        return;
    }

    if (!currentConfig.value) return alert('请先在“模型配置”选择一个 LLM 模型配置');
    if (!rawScript.value.trim()) return alert('请输入原文内容');

    isAnalyzingScript.value = true;
    analysisAbortController.value = new AbortController();

    let sfxSection = "";
    const enabledSfx = sfxLibrary.value.filter(s => s.enabled !== false);

    if (enabledSfx.length > 0) {
        const sfxList = enabledSfx.map(s => `- ${s.name}: ${s.description}`).join('\n');
        sfxSection = `# 音效库 (Sound Effects)\n你还可以使用以下音效素材，请根据剧情需要插入：\n${sfxList}\n**注意：必须严格使用列表中的名称，严禁编造不存在的音效。且绝对禁止使用 BGM 库中的名称。**`;
    } else {
        sfxSection = `# 音效库 (Sound Effects)\n当前音效库为空。\n**注意：请勿生成任何 'sfx' 字段。**`;
    }

    let bgmSection = "";
    const enabledBgm = bgmLibrary.value.filter(b => b.enabled !== false);
    if (enabledBgm.length > 0) {
        const bgmList = enabledBgm.map(s => `- ${s.name}: ${s.description}`).join('\n');
        bgmSection = `# 背景音乐库 (Background Music)\n现有以下背景音乐素材可用：\n${bgmList}\n\n**核心指令：**\n1. 必须**逐字匹配**使用列表中的名称。\n2. 如果列表中没有适合当前剧情的音乐，**请勿生成** BGM 播放指令。\n3. **严禁编造**列表中不存在的 BGM 名称。\n4. **绝对禁止**使用 SFX 库中的名称。`;
    } else {
        bgmSection = `# 背景音乐库 (Background Music)\n**当前背景音乐库为空 (EMPTY)。**\n\n**核心指令：**\n1. **严禁生成**任何 action="play" 的 BGM 控制块。\n2. 你只能生成 action="stop" 的指令（如果需要停止之前的音乐）。\n3. 绝对不要编造 BGM 名称。`;
    }

    let filterSection = "";
    const enabledFilters = filterLibrary.value.filter(f => f.enabled !== false);
    if (enabledFilters.length > 0) {
        const fList = enabledFilters.map(f => `- ${f.name}: ${f.description}`).join('\n');
        filterSection = `# 滤波器库 (Audio Filters)\n如果剧情需要特殊音效处理（如电话、水下、回忆），请使用以下滤波器：\n${fList}\n**注意：必须严格使用列表中的名称，如果没有匹配项则不要使用 filter 字段。**`;
    } else {
        filterSection = `# 滤波器库 (Audio Filters)\n当前滤波器库为空。\n**注意：请勿生成任何 filter 字段。**`;
    }

    const emotionList = emotionPresets.value.filter(e => e.enabled !== false).map(e => e.name).join(', ');

    const bgmExampleLine = enabledBgm.length > 0
        ? `{"type": "bgm", "action": "play", "name": "${enabledBgm[0].name}"},`
        : '';

    const sfxExample = enabledSfx.length > 0
        ? `, "sfx": [{"name": "${enabledSfx[0].name}", "position": 0.2}]`
        : '';

    let finalPrompt = scriptPromptTemplate.value
        .replace(/\${emotionList}/g, emotionList)
        .replace(/\${sfxSection}/g, sfxSection)
        .replace(/\${bgmSection}/g, bgmSection)
        .replace(/\${filterSection}/g, filterSection)
        .replace(/\${bgmExampleLine}/g, bgmExampleLine)
        .replace(/\${sfxExample}/g, sfxExample)
        .replace(/\${rawScript}/g, rawScript.value)
        .replace(/\${bgImageCount}/g, bgImageCount.value);

    // 兼容：当用户启用“自定义 Prompt”时，补充最低约束与数量约束（只添加，不删减原有 prompt）。
    if (useCustomPrompt.value) {
        if (!finalPrompt.includes('bgImage')) {
            finalPrompt += `

## 背景图片块 (bgImage)
- 需要在相邻的台词对象之间插入：\`{"type":"bgImage","image_prompt":"..."}\`
- \`image_prompt\` 必须为用于生成图片的中文提示词，并且要根据当前小说上下文生成。
- \`type\` 字段必须严格等于 \`bgImage\`。
`;
        }

        finalPrompt += `

## 背景图片块数量约束（严格遵守）
- 请在整个 JSON 数组中严格插入且仅插入 ${bgImageCount.value} 个 \`type":"bgImage"\` 对象。
- 第一个 \`bgImage\` 对象必须出现在“第一个 dialogue 对象之前”，用于视频开场背景；允许开头存在 \`bgm\` 控制块。
- 除开场第一张外，其余 \`bgImage\` 必须按剧情节奏插入在台词之间（至少间隔一个 \`dialogue\`），避免连续出现多个 \`bgImage\`。
`;
    }

    try {
        const cfg = currentConfig.value;
        const url = toChatCompletionsUrl(cfg.baseUrl);
        const body = buildLlmBody(cfg, [{ role: 'user', content: finalPrompt }]);
        const data = await postJson(url, body, {
            headers: { Authorization: `Bearer ${cfg.key}` },
            signal: analysisAbortController.value.signal
        });
        const content = data.choices[0]?.message?.content || '';
        rawAnalysisResult.value = content; // 保存原始输出
        const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
            // 移除拦截逻辑，完全信任 Prompt (或允许用户手动修正幻觉)
            const validParsed = parsed;

            const newRoles = new Set();
            validParsed.forEach(item => {
                const r = item.role_name || item.role;
                if (r) newRoles.add(r);
            });

            // 重新构建角色列表：清空并填充 (保留已有角色的音色配置)
            const newCharacterList = [];
            newRoles.forEach(rName => {
                const existing = characters.value.find(c => c.name === rName);
                let voiceFile = '';
                let id = Date.now() + Math.random().toString();
                let volume = 1.0;

                if (existing) {
                    voiceFile = existing.voiceFile;
                    id = existing.id;
                    volume = existing.volume ?? 1.0;
                } else {
                    const matchingTimbre = timbres.value.find(t => t.name === rName);
                    if (matchingTimbre) voiceFile = matchingTimbre.refPath;
                }

                newCharacterList.push({
                    id: id,
                    name: rName,
                    voiceFile: voiceFile,
                    volume: volume
                });
            });
            characters.value = newCharacterList;

            scriptLines.value = validParsed.map(item => {
                // 通用模糊匹配函数
                const findBestMatch = (target, library) => {
                    if (!target) return '';
                    const t = target.trim().toLowerCase();
                    // 1. 精确匹配
                    const exact = library.find(i => i.name.toLowerCase() === t);
                    if (exact) return exact.name;

                    // 2. 模糊匹配 (包含关系)
                    const candidates = library.filter(i => {
                        const n = i.name.toLowerCase();
                        return n.includes(t) || t.includes(n);
                    });

                    if (candidates.length > 0) {
                        // 按长度差排序，找最接近的
                        candidates.sort((a, b) => Math.abs(a.name.length - target.length) - Math.abs(b.name.length - target.length));
                        return candidates[0].name;
                    }
                    return '';
                };

                // 1. 匹配滤波器
                let matchedFilter = '';
                if (item.filter) {
                    matchedFilter = findBestMatch(item.filter, filterLibrary.value);
                }

                // 2. 匹配音效
                let matchedSfx = [];
                if (item.sfx && Array.isArray(item.sfx)) {
                    matchedSfx = item.sfx.map(s => ({
                        name: findBestMatch(s.name, sfxLibrary.value) || s.name,
                        position: s.position
                    }));
                }

                // 3. 匹配 BGM
                let matchedBgmName = '';
                if (item.type === 'bgm' && item.action === 'play') {
                    const rawName = item.name || item.bgmName || '';
                    matchedBgmName = findBestMatch(rawName, bgmLibrary.value) || rawName;
                }

                return {
                    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                    type: item.type || 'dialogue',
                    // Dialogue fields
                    role: item.role_name || item.role || '旁白',
                    text: item.text_content || item.text || item.content || '',
                    emotion: item.emotion || '平静',
                    intensity: item.intensity || '中等',
                    filter: matchedFilter,
                    sfx: matchedSfx,
                    break_duration: typeof item.break_duration === 'number' ? item.break_duration : 0,
                    trimStart: 0,
                    trimEnd: 1,
                    sfxVolume: 1.0,
                    dialogueVolume: 1.0,
                    audioUrl: '',
                    isGenerating: false,
                    // BGM fields
                    action: item.action || 'play',
                    volume: 1.0,
                    bgmName: matchedBgmName,

                    // bgImage fields (background-image block)
                    bgImagePrompt: item.image_prompt || item.bgImagePrompt || item.imagePrompt || item.prompt || '',
                    bgImageAssetKey: '',
                    imageUrl: ''
                };
            });
        } else {
            alert('AI 返回格式异常，请重试');
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            alert('分析已停止');
        } else {
            console.error(e);
            alert('分析失败: ' + e.message);
        }
    } finally {
        isAnalyzingScript.value = false;
        analysisAbortController.value = null;
    }
};


// ==================== Prompt Playground ====================

const clearAll = () => {
    result.value = '';
    reasoning.value = '';
    error.value = '';
};

const stopGeneration = () => {
    if (abortController.value) {
        abortController.value.abort();
        abortController.value = null;
        loading.value = false;
    }
};

/**
 * 调用 OpenAI 兼容接口进行流式文本对话。
 * @returns {Promise<void>}
 */
const send = async () => {
    if (!currentConfig.value) return alert('请先选择一个有效的模型配置');
    const cfg = currentConfig.value;

    loading.value = true;
    result.value = '';
    reasoning.value = '';
    error.value = '';

    abortController.value = new AbortController();

    try {
        let url = cfg.baseUrl.trim().replace(/\/+$/, '');

        if (!url.endsWith('/chat/completions')) {
            url += '/chat/completions';
        }

        let body = {
            model: cfg.model,
            messages: [{ role: 'user', content: prompt.value }],
            stream: true
        };

        if (cfg.params) {
            try {
                const extraParams = JSON.parse(cfg.params);
                body = { ...body, ...extraParams };
            } catch (e) {
                console.warn('解析额外参数失败:', e);
            }
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.key}`
            },
            body: JSON.stringify(body),
            signal: abortController.value.signal
        });

        if (!res.ok) {
            const errData = await res.text();
            throw new Error(`HTTP ${res.status}: ${errData}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保持最后一行完整

            for (const line of lines) {
                const cleanLine = line.replace(/^data: /, '').trim();
                if (!cleanLine || cleanLine === '[DONE]') continue;

                try {
                    const json = JSON.parse(cleanLine);
                    const delta = json.choices[0]?.delta;

                    if (delta?.reasoning_content) {
                        reasoning.value += delta.reasoning_content;
                    }
                    if (delta?.content) {
                        result.value += delta.content;
                    }
                } catch (e) {
                    // 忽略部分解析错误
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            // 用户手动停止，不报错
        } else {
            error.value = e.message;
            if (e.message.includes('Failed to fetch')) {
                error.value += "\n\n检测到跨域(CORS)限制！Gemini API 通常禁止从浏览器前端直接调用。\n建议：开启浏览器 CORS 插件，或使用后端中转。";
            }
        }
    } finally {
        loading.value = false;
        abortController.value = null;
    }
};

// ==================== Direct TTS Playground ====================

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        ttsRefFile.value = file;
        if (!ttsRefPath.value || ttsRefPath.value === 'uploaded/ref.wav') {
            ttsRefPath.value = `uploaded/${file.name}`;
        }
    }
};

const stopTtsGeneration = () => {
    if (ttsAbortController.value) {
        ttsAbortController.value.abort();
        ttsAbortController.value = null;
        ttsLoading.value = false;
    }
};

/**
 * 使用当前 TTS 配置对输入文本进行直接语音合成。
 * @returns {Promise<void>}
 */
const synthesizeAudio = async () => {
    if (!currentTtsConfig.value) return alert('请选择 TTS 配置');
    const textToSpeak = result.value || prompt.value;
    if (!textToSpeak) return alert('没有可合成的文本 (请先对话或输入提示词)');
    if (!ttsRefPath.value) return alert('请指定参考音频路径 ID');

    ttsLoading.value = true;
    ttsError.value = '';
    audioUrl.value = '';

    ttsAbortController.value = new AbortController();

    const cfg = currentTtsConfig.value;
    const baseUrl = toTtsBaseUrl(cfg.baseUrl);

    try {
        // 1. 检查音频是否存在
        const checkUrl = `${baseUrl}/v1/check/audio?file_name=${encodeURIComponent(ttsRefPath.value)}`;
        const checkData = await getJson(checkUrl, { signal: ttsAbortController.value.signal });

        // 2. 上传逻辑：如果用户选择了文件，强制上传（覆盖）；否则检查服务端是否存在
        // 修改：即使服务端存在，只要用户选了新文件，就强制上传，防止文件内容不一致或服务端文件损坏
        if (ttsRefFile.value) {
            const formData = new FormData();
            formData.append('audio', ttsRefFile.value);
            formData.append('full_path', ttsRefPath.value);

            await postForm(`${baseUrl}/v1/upload_audio`, formData, {
                signal: ttsAbortController.value.signal
            });
        } else if (!checkData.exists) {
            throw new Error(`服务端未找到音频 "${ttsRefPath.value}"，且未选择本地文件进行上传。`);
        }

        // 3. 合成语音
        const synthPayload = {
            text: textToSpeak,
            audio_path: ttsRefPath.value,
            emo_text: ttsEmoText.value || '中立'
        };

        const blob = await postBlob(`${baseUrl}/v2/synthesize`, synthPayload, {
            signal: ttsAbortController.value.signal
        });

        // 4. 处理二进制音频流
        audioUrl.value = URL.createObjectURL(blob);

    } catch (e) {
        if (e.name === 'AbortError') {
            // 用户手动停止
        } else {
            console.error(e);
            ttsError.value = e.message;
        }
    } finally {
        ttsLoading.value = false;
        ttsAbortController.value = null;
    }
};

provide(workbenchContextKey, {
    activeTab,
    exportScriptState,
    isExportingProject,
    exportStatus,
    triggerImport,
    triggerImportTxt,
    exportSRT,
    isExportingAudio,
    exportAudio,
    videoResolution,
    generateVideo,
    isSequencePlaying,
    isGeneratingVideo,
    importFileRef,
    handleImportFile,
    importTxtRef,
    handleImportTxt,
    bgImagePickerRef,
    handleBgImageFileChange,
    form,
    isEditing,
    saveConfig,
    resetForm,
    llmConfigs,
    editConfig,
    deleteConfig,
    isEditingTts,
    ttsForm,
    saveTtsConfig,
    resetTtsForm,
    ttsConfigs,
    editTtsConfig,
    deleteTtsConfig,
    isEditingTimbre,
    timbreForm,
    handleTimbreFileUpload,
    saveTimbre,
    resetTimbreForm,
    timbres,
    playPreview,
    previewPlayingFile,
    editTimbre,
    deleteTimbre,
    isEditingEmotion,
    emotionForm,
    saveEmotion,
    resetEmotionForm,
    emotionPresets,
    isSystemEmotion,
    editEmotion,
    deleteEmotion,
    isEditingSfx,
    sfxForm,
    handleSfxFileUpload,
    drawWaveform,
    startDragTrim,
    playbackProgress,
    saveSfx,
    resetSfxForm,
    sfxLibrary,
    editSfx,
    deleteSfx,
    isEditingBgm,
    bgmForm,
    handleBgmFileUpload,
    saveBgm,
    resetBgmForm,
    bgmLibrary,
    editBgm,
    deleteBgm,
    isEditingFilter,
    filterForm,
    saveFilter,
    resetFilterForm,
    filterLibrary,
    editFilter,
    deleteFilter,
    scriptList,
    currentScriptId,
    editingScriptId,
    switchScript,
    startEditingScript,
    stopEditingScript,
    scriptNameInputRefs,
    deleteScriptTab,
    addScript,
    characters,
    addCharacter,
    deleteCharacter,
    analyzeCharacterVoice,
    generateQwenVoice,
    rawScript,
    currentConfigId,
    currentTtsConfigId,
    analyzeScript,
    isAnalyzingScript,
    addDialogueBlock,
    addBgmBlock,
    addBgImageBlock,
    bgImageCount,
    generateAllLines,
    isGeneratingAll,
    selectedLineIndex,
    clearAllGeneratedAudio,
    playScriptSequentially,
    stopScriptSequentially,
    scriptLines,
    stageBgUrl,
    scriptListContainer,
    lineRefs,
    toggleLineSelection,
    currentSequenceIndex,
    moveLineUp,
    moveLineDown,
    openImagePreview,
    openBgImagePicker,
    copyBgImagePrompt,
    availableRoles,
    generateLineAudio,
    isAuditioningId,
    playLineAudio,
    clearLineAudio,
    autoResizeTextarea,
    addLineSfx,
    removeLineSfx,
    rawAnalysisResult,
    savePrompt,
    resetPrompt,
    useCustomPrompt,
    customPromptTemplate,
    saveVoicePrompt,
    resetVoicePrompt,
    useCustomVoicePrompt,
    customVoicePromptTemplate,
    saveQwenVoiceText,
    resetQwenVoiceText,
    useCustomQwenVoiceText,
    customQwenVoiceTextTemplate
});
</script>

<template>
<div id="app" class="w-full max-w-[96%] mx-auto p-6 rounded-2xl shadow-2xl">
    <div v-if="previewImageUrl" @click="closeImagePreview"
        class="fixed inset-0 z-[10000] bg-slate-950/78 backdrop-blur-sm flex items-center justify-center p-4">
        <el-button @click.stop="closeImagePreview"
            class="absolute top-4 right-4">
            <el-icon><Close /></el-icon>
            关闭
        </el-button>
        <img :src="previewImageUrl" alt="背景图片大图预览" @click.stop
            class="max-w-[95vw] max-h-[92vh] object-contain rounded-xl shadow-2xl bg-white">
    </div>
    <WorkbenchHeader />

    <ConfigTab v-if="activeTab === 'config'" />

    <TimbresTab v-if="activeTab === 'timbres'" />

    <SfxTab v-if="activeTab === 'sfx'" />

    <ScriptTab v-if="activeTab === 'script'" />

    <!-- 页面 7: Prompt 管理 -->
    <PromptTab v-if="activeTab === 'prompt'" />

    <p style="text-align: left; color: #888; font-size: 12px;">
        <a href="https://space.bilibili.com/11354448" target="_blank"
            style="color: inherit; text-decoration: none;">
            本网站由sdsds222制作，点击此处访问个人主页
        </a>
    </p>

</div>
</template>
