import { computed, ref, watch } from 'vue';

import {
  createAssetKey,
  createBgImageLine,
  createBgmLine,
  createCharacterBinding,
  createDialogueLine,
  type AudioLibraryItem,
  type BgImageLine,
  type BgmLine,
  type CharacterBinding,
  type DialogueLine,
  type FilterLibraryItem,
  type ScriptLine
} from '../domain/project';
import { AssetRepository } from '../services/storage/assetRepository';
import { LlmClient } from '../services/providers/llmClient';
import { ensureReferenceAudioUploaded } from '../services/providers/ttsAssetSync';
import {
  loadVoiceDesignOptions,
  type VoiceDesignOption
} from '../services/providers/voiceDesignCatalog';
import { VoiceDesignClient } from '../services/providers/voiceDesignClient';
import { ScriptWorkflowPreferenceRepository } from '../services/storage/scriptWorkflowPreferenceRepository';
import { useJobsStore } from '../stores/jobs.store';
import { useLibraryStore } from '../stores/library.store';
import { useProjectStore } from '../stores/project.store';
import { useSettingsStore } from '../stores/settings.store';
import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_QWEN_VOICE_TEXT_TEMPLATE,
  DEFAULT_VOICE_PROMPT_TEMPLATE
} from '../stores/settings.defaults';

const assetRepository = new AssetRepository();
const llmClient = new LlmClient();
const voiceDesignClient = new VoiceDesignClient();
const workflowPreferenceRepository = new ScriptWorkflowPreferenceRepository();

const findBestMatch = <T extends { name: string }>(target: string, library: T[]): string => {
  const normalizedTarget = target.trim().toLowerCase();

  if (!normalizedTarget) {
    return '';
  }

  const exact = library.find((item) => item.name.trim().toLowerCase() === normalizedTarget);

  if (exact) {
    return exact.name;
  }

  const candidates = library.filter((item) => {
    const normalizedName = item.name.trim().toLowerCase();
    return normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
  });

  if (candidates.length === 0) {
    return '';
  }

  candidates.sort(
    (left, right) =>
      Math.abs(left.name.length - target.length) - Math.abs(right.name.length - target.length)
  );

  return candidates[0]?.name ?? '';
};

const parseJsonArrayContent = (content: string): unknown[] => {
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  const jsonString = jsonMatch
    ? jsonMatch[0]
    : content.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(jsonString) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回的不是 JSON 数组。');
  }

  return parsed;
};

const createAnalysisScriptLines = (items: unknown[], options: {
  bgmLibrary: AudioLibraryItem[];
  filterLibrary: FilterLibraryItem[];
  sfxLibrary: AudioLibraryItem[];
}): ScriptLine[] => {
  return items.map((item) => {
    const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const rawType = typeof source.type === 'string' ? source.type : 'dialogue';

    if (rawType === 'bgm') {
      const rawName =
        (typeof source.name === 'string' ? source.name : '') ||
        (typeof source.bgmName === 'string' ? source.bgmName : '');

      return createBgmLine({
        action: typeof source.action === 'string' && source.action ? source.action : 'play',
        bgmName: findBestMatch(rawName, options.bgmLibrary) || rawName,
        volume:
          typeof source.volume === 'number' && Number.isFinite(source.volume)
            ? source.volume
            : 1
      } satisfies Partial<BgmLine>);
    }

    if (rawType === 'bgImage') {
      return createBgImageLine({
        bgImagePrompt:
          (typeof source.image_prompt === 'string' && source.image_prompt) ||
          (typeof source.bgImagePrompt === 'string' && source.bgImagePrompt) ||
          (typeof source.imagePrompt === 'string' && source.imagePrompt) ||
          (typeof source.prompt === 'string' ? source.prompt : '')
      } satisfies Partial<BgImageLine>);
    }

    const rawSfx = Array.isArray(source.sfx) ? source.sfx : [];
    const matchedSfx = rawSfx.map((sfxItem) => {
      const sfxSource =
        sfxItem && typeof sfxItem === 'object' ? (sfxItem as Record<string, unknown>) : {};
      const rawName = typeof sfxSource.name === 'string' ? sfxSource.name : '';

      return {
        name: findBestMatch(rawName, options.sfxLibrary) || rawName,
        position:
          typeof sfxSource.position === 'number' && Number.isFinite(sfxSource.position)
            ? sfxSource.position
            : 0
      };
    });

    const rawFilter = typeof source.filter === 'string' ? source.filter : '';

    return createDialogueLine({
      role:
        (typeof source.role_name === 'string' && source.role_name) ||
        (typeof source.role === 'string' && source.role) ||
        '旁白',
      text:
        (typeof source.text_content === 'string' && source.text_content) ||
        (typeof source.text === 'string' && source.text) ||
        (typeof source.content === 'string' ? source.content : ''),
      emotion:
        typeof source.emotion === 'string' && source.emotion ? source.emotion : '平静',
      intensity:
        typeof source.intensity === 'string' && source.intensity ? source.intensity : '中等',
      break_duration:
        typeof source.break_duration === 'number' && Number.isFinite(source.break_duration)
          ? source.break_duration
          : 0,
      filter: findBestMatch(rawFilter, options.filterLibrary),
      sfx: matchedSfx
    } satisfies Partial<DialogueLine>);
  });
};

const buildCharacterList = (lines: ScriptLine[], characters: CharacterBinding[], timbres: {
  assetKey: string;
  name: string;
  refPath: string;
}[]): CharacterBinding[] => {
  const roleNames = new Set<string>();

  lines.forEach((line) => {
    if (line.type === 'dialogue' && line.role) {
      roleNames.add(line.role);
    }
  });

  return Array.from(roleNames).map((roleName) => {
    const existing = characters.find((character) => character.name === roleName);
    const matchedTimbre = timbres.find((item) => item.name === roleName);

    return createCharacterBinding({
      id: existing?.id,
      name: roleName,
      voiceFile: existing?.voiceFile || matchedTimbre?.refPath || '',
      voiceAssetKey: existing?.voiceAssetKey || matchedTimbre?.assetKey || '',
      volume: existing?.volume ?? 1,
      voiceDescription: existing?.voiceDescription || matchedTimbre?.description || '',
      voicePromptText: existing?.voicePromptText || matchedTimbre?.promptText || ''
    });
  });
};

const buildAnalysisPrompt = (options: {
  bgImageCount: number;
  customPromptTemplate: string;
  emotionList: string;
  enabledBgm: AudioLibraryItem[];
  enabledFilters: FilterLibraryItem[];
  enabledSfx: AudioLibraryItem[];
  rawScript: string;
  useCustomPrompt: boolean;
}): string => {
  const {
    bgImageCount,
    customPromptTemplate,
    emotionList,
    enabledBgm,
    enabledFilters,
    enabledSfx,
    rawScript,
    useCustomPrompt
  } = options;

  const sfxSection =
    enabledSfx.length > 0
      ? `# 音效库 (Sound Effects)\n你还可以使用以下音效素材，请根据剧情需要插入：\n${enabledSfx
          .map((item) => `- ${item.name}: ${item.description}`)
          .join('\n')}\n**注意：必须严格使用列表中的名称，严禁编造不存在的音效。且绝对禁止使用 BGM 库中的名称。**`
      : `# 音效库 (Sound Effects)\n当前音效库为空。\n**注意：请勿生成任何 'sfx' 字段。**`;

  const bgmSection =
    enabledBgm.length > 0
      ? `# 背景音乐库 (Background Music)\n现有以下背景音乐素材可用：\n${enabledBgm
          .map((item) => `- ${item.name}: ${item.description}`)
          .join('\n')}\n\n**核心指令：**\n1. 必须**逐字匹配**使用列表中的名称。\n2. 如果列表中没有适合当前剧情的音乐，**请勿生成** BGM 播放指令。\n3. **严禁编造**列表中不存在的 BGM 名称。\n4. **绝对禁止**使用 SFX 库中的名称。`
      : `# 背景音乐库 (Background Music)\n**当前背景音乐库为空 (EMPTY)。**\n\n**核心指令：**\n1. **严禁生成**任何 action="play" 的 BGM 控制块。\n2. 你只能生成 action="stop" 的指令（如果需要停止之前的音乐）。\n3. 绝对不要编造 BGM 名称。`;

  const filterSection =
    enabledFilters.length > 0
      ? `# 滤波器库 (Audio Filters)\n如果剧情需要特殊音效处理（如电话、水下、回忆），请使用以下滤波器：\n${enabledFilters
          .map((item) => `- ${item.name}: ${item.description}`)
          .join('\n')}\n**注意：必须严格使用列表中的名称，如果没有匹配项则不要使用 filter 字段。**`
      : `# 滤波器库 (Audio Filters)\n当前滤波器库为空。\n**注意：请勿生成任何 filter 字段。**`;

  const bgmExampleLine =
    enabledBgm.length > 0
      ? `{"type": "bgm", "action": "play", "name": "${enabledBgm[0].name}"},`
      : '';

  const sfxExample =
    enabledSfx.length > 0
      ? `, "sfx": [{"name": "${enabledSfx[0].name}", "position": 0.2}]`
      : '';

  let prompt = customPromptTemplate
    .replace(/\${emotionList}/g, emotionList)
    .replace(/\${sfxSection}/g, sfxSection)
    .replace(/\${bgmSection}/g, bgmSection)
    .replace(/\${filterSection}/g, filterSection)
    .replace(/\${bgmExampleLine}/g, bgmExampleLine)
    .replace(/\${sfxExample}/g, sfxExample)
    .replace(/\${rawScript}/g, rawScript)
    .replace(/\${bgImageCount}/g, String(bgImageCount));

  if (!useCustomPrompt) {
    return prompt;
  }

  if (!prompt.includes('bgImage')) {
    prompt += `\n\n## 背景图片块 (bgImage)\n- 需要在相邻的台词对象之间插入：\`{"type":"bgImage","image_prompt":"..."}\`\n- \`image_prompt\` 必须为用于生成图片的中文提示词，并且要根据当前小说上下文生成。\n- \`type\` 字段必须严格等于 \`bgImage\`。`;
  }

  prompt += `\n\n## 背景图片块数量约束（严格遵守）\n- 请在整个 JSON 数组中严格插入且仅插入 ${bgImageCount} 个 \`type":"bgImage"\` 对象。\n- 第一个 \`bgImage\` 对象必须出现在“第一个 dialogue 对象之前”，用于视频开场背景；允许开头存在 \`bgm\` 控制块。\n- 除开场第一张外，其余 \`bgImage\` 必须按剧情节奏插入在台词之间（至少间隔一个 \`dialogue\`），避免连续出现多个 \`bgImage\`。`;

  return prompt;
};

export const useScriptAiWorkflow = (options: {
  jobsStore: ReturnType<typeof useJobsStore>;
  libraryStore: ReturnType<typeof useLibraryStore>;
  projectStore: ReturnType<typeof useProjectStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
}) => {
  const { jobsStore, libraryStore, projectStore, settingsStore } = options;
  const isAnalyzingScript = ref(false);
  const analysisAbortController = ref<AbortController | null>(null);
  const voiceDesigns = ref<VoiceDesignOption[]>(loadVoiceDesignOptions());
  const bgImageCount = ref(workflowPreferenceRepository.getBgImageCount());
  const selectedVoiceDesignUrl = ref('');

  const savedVoiceDesignUrl = workflowPreferenceRepository.getSelectedVoiceDesignUrl();
  selectedVoiceDesignUrl.value =
    voiceDesigns.value.find((item) => item.url === savedVoiceDesignUrl)?.url ??
    voiceDesigns.value[0]?.url ??
    '';

  const currentScript = computed(() => projectStore.currentScript);
  const currentLlmConfig = computed(() =>
    settingsStore.llmConfigs.find((item) => item.id === settingsStore.currentConfigId) ?? null
  );
  const currentTtsConfig = computed(() =>
    settingsStore.ttsConfigs.find((item) => item.id === settingsStore.currentTtsConfigId) ?? null
  );
  const selectedVoiceDesign = computed(
    () =>
      voiceDesigns.value.find((item) => item.url === selectedVoiceDesignUrl.value) ??
      voiceDesigns.value[0] ??
      null
  );
  const selectedVoiceDesignName = computed(
    () => selectedVoiceDesign.value?.name || '当前音色模型'
  );

  watch(selectedVoiceDesignUrl, (value) => {
    workflowPreferenceRepository.setSelectedVoiceDesignUrl(value);
  });

  watch(bgImageCount, (value) => {
    workflowPreferenceRepository.setBgImageCount(value);
  });

  const analyzeScript = async () => {
    if (isAnalyzingScript.value) {
      analysisAbortController.value?.abort();
      return;
    }

    if (!currentScript.value) {
      window.alert('当前没有可分析的脚本。');
      return;
    }

    if (!currentLlmConfig.value) {
      window.alert('请先在“模型配置”中选择一个 LLM 模型配置。');
      return;
    }

    if (!currentScript.value.data.rawScript.trim()) {
      window.alert('请输入原文内容。');
      return;
    }

    isAnalyzingScript.value = true;
    jobsStore.updateJob('analysis', 'running', '正在请求 LLM 分析脚本并生成结构化块。');
    const controller = new AbortController();
    analysisAbortController.value = controller;

    try {
      const enabledSfx = libraryStore.sfxLibrary.filter((item) => item.enabled !== false);
      const enabledBgm = libraryStore.bgmLibrary.filter((item) => item.enabled !== false);
      const enabledFilters = libraryStore.filterLibrary.filter(
        (item) => item.enabled !== false
      );
      const emotionList =
        libraryStore.emotionPresets
          .filter((item) => item.enabled !== false)
          .map((item) => item.name)
          .join(', ') || '平静';
      const prompt = buildAnalysisPrompt({
        bgImageCount: bgImageCount.value,
        customPromptTemplate: settingsStore.useCustomPrompt
          ? settingsStore.customPromptTemplate
          : DEFAULT_PROMPT_TEMPLATE,
        emotionList,
        enabledBgm,
        enabledFilters,
        enabledSfx,
        rawScript: currentScript.value.data.rawScript,
        useCustomPrompt: settingsStore.useCustomPrompt
      });

      let params: Record<string, unknown> = {};

      if (currentLlmConfig.value.params) {
        try {
          params = JSON.parse(currentLlmConfig.value.params) as Record<string, unknown>;
        } catch (error) {
          console.warn('忽略无法解析的 LLM 额外参数:', error);
        }
      }

      const response = await llmClient.chatCompletions(currentLlmConfig.value.baseUrl, {
        apiKey: currentLlmConfig.value.key,
        messages: [{ role: 'user', content: prompt }],
        model: currentLlmConfig.value.model,
        params,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`LLM 请求失败：HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim() ?? '';

      if (!content) {
        throw new Error('LLM 没有返回可解析的内容。');
      }

      const parsedItems = parseJsonArrayContent(content);
      const nextLines = createAnalysisScriptLines(parsedItems, {
        bgmLibrary: libraryStore.bgmLibrary,
        filterLibrary: libraryStore.filterLibrary,
        sfxLibrary: libraryStore.sfxLibrary
      });
      const nextCharacters = buildCharacterList(
        nextLines,
        projectStore.currentCharacters,
        libraryStore.timbres
      );

      projectStore.replaceCurrentScriptData({
        characters: nextCharacters,
        rawAnalysisResult: content,
        scriptLines: nextLines
      });
      jobsStore.updateJob(
        'analysis',
        'success',
        `脚本分析完成，生成 ${nextLines.length} 个块、${nextCharacters.length} 个角色。`
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        jobsStore.updateJob('analysis', 'idle', '已取消当前脚本分析。');
        return;
      }

      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('analysis', 'error', `脚本分析失败：${message}`);
      window.alert(`脚本分析失败：${message}`);
    } finally {
      isAnalyzingScript.value = false;
      analysisAbortController.value = null;
    }
  };

  const analyzeCharacterVoice = async (characterId: string) => {
    const character = projectStore.currentCharacters.find((item) => item.id === characterId);

    if (!character) {
      return;
    }

    if (character.isAnalyzing) {
      character.abortController?.abort();
      return;
    }

    if (!currentLlmConfig.value) {
      window.alert('请先在“模型配置”中配置 LLM。');
      return;
    }

    if (!currentScript.value?.data.rawScript.trim()) {
      window.alert('请先输入原始剧本。');
      return;
    }

    character.isAnalyzing = true;
    const controller = new AbortController();
    character.abortController = controller;
    jobsStore.updateJob('voiceDesign', 'running', `正在分析角色「${character.name}」的音色描述。`);

    try {
      const promptTemplate = settingsStore.useCustomVoicePrompt
        ? settingsStore.customVoicePromptTemplate
        : DEFAULT_VOICE_PROMPT_TEMPLATE;
      const prompt = promptTemplate
        .replace(/\${charName}/g, character.name)
        .replace(/\${rawScript}/g, currentScript.value.data.rawScript.slice(0, 3000));
      let params: Record<string, unknown> = {};

      if (currentLlmConfig.value.params) {
        try {
          params = JSON.parse(currentLlmConfig.value.params) as Record<string, unknown>;
        } catch (error) {
          console.warn('忽略无法解析的 LLM 额外参数:', error);
        }
      }
      const response = await llmClient.chatCompletions(currentLlmConfig.value.baseUrl, {
        apiKey: currentLlmConfig.value.key,
        messages: [{ role: 'user', content: prompt }],
        model: currentLlmConfig.value.model,
        params,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`LLM 请求失败：HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
      character.voiceDescription = content;
      jobsStore.updateJob(
        'voiceDesign',
        'success',
        `角色「${character.name}」音色描述分析完成。`
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        jobsStore.updateJob('voiceDesign', 'idle', `已取消角色「${character.name}」音色分析。`);
        return;
      }

      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('voiceDesign', 'error', `音色分析失败：${message}`);
      window.alert(`角色音色分析失败：${message}`);
    } finally {
      character.isAnalyzing = false;
      delete character.abortController;
    }
  };

  const generateCharacterVoice = async (characterId: string) => {
    const character = projectStore.currentCharacters.find((item) => item.id === characterId);

    if (!character) {
      return;
    }

    if (character.isGeneratingVoice) {
      character.abortController?.abort();
      return;
    }

    if (!currentTtsConfig.value) {
      window.alert('请先选择 TTS 服务。');
      return;
    }

    if (!selectedVoiceDesign.value?.url) {
      window.alert('请先选择音色生成模型。');
      return;
    }

    if (!character.voiceDescription.trim()) {
      window.alert('请先填写或分析音色描述。');
      return;
    }

    character.isGeneratingVoice = true;
    const controller = new AbortController();
    character.abortController = controller;
    jobsStore.updateJob(
      'voiceDesign',
      'running',
      `正在为角色「${character.name}」生成参考音频并写入音色库。`
    );

    try {
      const generationText = (
        settingsStore.useCustomQwenVoiceText
          ? settingsStore.customQwenVoiceTextTemplate
          : DEFAULT_QWEN_VOICE_TEXT_TEMPLATE
      )
        .replace(/\${charName}/g, character.name)
        .replace(/\${char\.name}/g, character.name);
      const response = await voiceDesignClient.designVoice(
        selectedVoiceDesign.value.url,
        {
          text: generationText,
          voice_description: character.voiceDescription
        },
        controller.signal
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const fileNamePrefix =
        selectedVoiceDesign.value.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'voice';
      const fileName = `${fileNamePrefix}_${character.name}_${Date.now()}.wav`;
      const file = new File([blob], fileName, { type: blob.type || 'audio/wav' });
      const timbreName = `${character.name}_AI`;
      const existingTimbre = libraryStore.timbres.find((item) => item.name === timbreName);
      const assetKey = existingTimbre?.assetKey || createAssetKey('timbre', fileName);
      const saved = await libraryStore.saveTimbreFile(file, assetKey);

      await ensureReferenceAudioUploaded({
        baseUrl: currentTtsConfig.value.baseUrl,
        file,
        fileName,
        promptText: generationText,
        signal: controller.signal
      });

      await libraryStore.saveTimbre({
        id: existingTimbre?.id || '',
        assetKey: saved.assetKey,
        description: character.voiceDescription,
        name: timbreName,
        promptText: generationText,
        refPath: saved.refPath
      });

      character.voiceFile = saved.refPath;
      character.voiceAssetKey = saved.assetKey;
      jobsStore.updateJob(
        'voiceDesign',
        'success',
        `角色「${character.name}」音色已生成并同步到音色库。`
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        jobsStore.updateJob('voiceDesign', 'idle', `已取消角色「${character.name}」的音色生成。`);
        return;
      }

      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('voiceDesign', 'error', `音色生成失败：${message}`);
      window.alert(`音色生成失败：${message}`);
    } finally {
      character.isGeneratingVoice = false;
      delete character.abortController;
    }
  };

  const syncTimbresWithServer = async () => {
    if (!currentTtsConfig.value) {
      window.alert('请先选择 TTS 服务。');
      return;
    }

    jobsStore.updateJob('voiceDesign', 'running', '正在校验音色资源并同步到 TTS 服务。');

    try {
      let uploadedCount = 0;

      for (const timbre of libraryStore.timbres) {
        if (!timbre.refPath || !timbre.assetKey) {
          continue;
        }

        const blob = await assetRepository.loadAsset(timbre.assetKey);

        if (!blob) {
          continue;
        }

        await ensureReferenceAudioUploaded({
          baseUrl: currentTtsConfig.value.baseUrl,
          file: blob,
          fileName: timbre.refPath,
          promptText: timbre.promptText
        });
        uploadedCount += 1;
      }

      jobsStore.updateJob(
        'voiceDesign',
        'success',
        `音色同步完成，本轮校验 ${uploadedCount} 个参考音频。`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      jobsStore.updateJob('voiceDesign', 'error', `音色同步失败：${message}`);
      window.alert(`音色同步失败：${message}`);
    }
  };

  return {
    isAnalyzingScript,
    voiceDesigns,
    selectedVoiceDesignUrl,
    selectedVoiceDesign,
    selectedVoiceDesignName,
    bgImageCount,
    analyzeScript,
    analyzeCharacterVoice,
    generateCharacterVoice,
    syncTimbresWithServer,
    currentLlmConfig,
    currentTtsConfig
  };
};
