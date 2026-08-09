(function (global) {
    const PROJECT_KIND = 'unitale-project';
    const PROJECT_SCHEMA_VERSION = 4;
    const PROJECT_VERSION_LABEL = '4.0';
    const VOXCPM_CLONE_MODES = new Set(['ultimate', 'controllable']);
    const VOXCPM_DELIVERY_PROFILES = new Set(['baseline', 'expressive', 'suspense', 'fear', 'urgent', 'restrained']);
    // VoxCPM2 官方支持的非语言标签；工程中只保存标签名，后端统一负责拼接为 [tag]。
    const VOXCPM_NONVERBAL_TAGS = new Set([
        'laughing', 'sigh', 'Uhm', 'Shh', 'Question-ah', 'Question-ei',
        'Question-en', 'Question-oh', 'Surprise-wa', 'Surprise-yo', 'Dissatisfaction-hnn'
    ]);

    function cloneData(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function createId(prefix) {
        const safePrefix = prefix || 'id';
        return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function sanitizeFilename(name) {
        const cleaned = String(name || 'asset')
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return cleaned || 'asset';
    }

    function createAssetKey(kind, filename) {
        const safeKind = kind || 'asset';
        const safeName = sanitizeFilename(filename).slice(-48);
        return `${safeKind}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${safeName || 'file'}`;
    }

    function ensureArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function toNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeTrimRange(item, defaultStart, defaultEnd) {
        const start = clamp(toNumber(item && item.trimStart, defaultStart), 0, 1);
        let end = clamp(toNumber(item && item.trimEnd, defaultEnd), 0, 1);
        if (end <= start) {
            end = Math.min(1, start + 0.01);
        }
        return { trimStart: start, trimEnd: end };
    }

    function createVoiceLookup(timbres) {
        const byPath = new Map();
        const byName = new Map();

        ensureArray(timbres).forEach((timbre) => {
            if (timbre && timbre.refPath && timbre.assetKey && !byPath.has(timbre.refPath)) {
                byPath.set(timbre.refPath, timbre.assetKey);
            }
            if (timbre && timbre.name && !byName.has(timbre.name)) {
                byName.set(timbre.name, timbre);
            }
        });

        return { byPath, byName };
    }

    /**
     * 规范化台词的 VoxCPM2 非语言标签。
     * 兼容导入时的字符串/数组输入，但只保留官方白名单中的第一个标签，避免模型目标文本出现多个标签。
     * @param {unknown} value 原始标签
     * @returns {string[]} 长度为 0 或 1 的官方标签数组
     */
    function normalizeVoxCpmNonverbalTags(value) {
        const candidates = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
        const validTag = candidates
            .map((item) => typeof item === 'string' ? item.trim() : '')
            .find((item) => VOXCPM_NONVERBAL_TAGS.has(item));
        return validTag ? [validTag] : [];
    }

    /**
     * 规范化由 MOSS-SoundEffect 生成的音效计划及其绑定 WAV 资产键。
     * @param {unknown} value 原始 sfx_plan 字段
     * @returns {Array<Object>} 最多两条可持久化计划
     */
    function normalizeSfxPlans(value, lineId) {
        const purposes = new Set(['semantic_cue', 'foreground_action', 'ambience', 'transition']);
        const anchors = new Set(['dialogue_start', 'dialogue_end', 'break_start']);
        const mixPresets = new Set(['cue_before_dialogue', 'action_under_dialogue', 'soft_ambience', 'transition']);
        const defaultMixPreset = {
            semantic_cue: 'cue_before_dialogue',
            foreground_action: 'action_under_dialogue',
            ambience: 'soft_ambience',
            transition: 'transition'
        };

        return ensureArray(value).slice(0, 2).reduce((plans, item, index) => {
            if (!item || typeof item !== 'object') return plans;
            const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
            if (!prompt) return plans;

            const purpose = purposes.has(item.purpose) ? item.purpose : 'foreground_action';
            const duration = toNumber(item.duration_seconds, 1.0);
            const planId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `sfx_plan_${index + 1}`;
            plans.push({
                ...item,
                id: planId,
                action: 'generate',
                purpose,
                sound_class: typeof item.sound_class === 'string' && item.sound_class.trim()
                    ? item.sound_class.trim()
                    : '未分类声音',
                prompt: prompt.slice(0, 1000),
                anchor: anchors.has(item.anchor) ? item.anchor : 'dialogue_start',
                offset_ms: clamp(Math.round(toNumber(item.offset_ms, 0)), -500, 5000),
                duration_seconds: clamp(duration > 0 ? duration : 1.0, 0.2, 30),
                mix_preset: mixPresets.has(item.mix_preset) ? item.mix_preset : defaultMixPreset[purpose],
                required: item.required === true,
                // 每条计划拥有自己的生成 WAV；不再通过 name 回查工程级 SFX 素材库。
                audioAssetKey: typeof item.audioAssetKey === 'string' && item.audioAssetKey
                    ? item.audioAssetKey
                    : `soundeffect_${lineId}_${planId}`,
                audioUrl: '',
                isGenerating: false,
                generationError: ''
            });
            return plans;
        }, []);
    }

    function normalizeLibraryItem(kind, item) {
        const source = item && typeof item === 'object' ? cloneData(item) : {};
        const normalized = { ...source };
        const trim = normalizeTrimRange(normalized, 0, 1);
        const isTimbre = kind === 'timbre';

        normalized.id = normalized.id || createId(kind);
        normalized.assetKey = normalized.assetKey || '';

        if (isTimbre) {
            normalized.name = normalized.name || '未命名音色';
            normalized.description = normalized.description || '';
            normalized.promptText = normalized.promptText || '';
            normalized.refPath = normalized.refPath || '';
            if (!normalized.assetKey && normalized.refPath && !/^(https?:\/\/|blob:|data:)/.test(normalized.refPath)) {
                normalized.assetKey = createAssetKey('legacy_timbre', normalized.refPath);
            }
            return normalized;
        }

        normalized.name = normalized.name || '';
        normalized.description = normalized.description || '';
        normalized.filename = normalized.filename || '';
        normalized.trimStart = trim.trimStart;
        normalized.trimEnd = trim.trimEnd;
        normalized.volume = toNumber(normalized.volume, 0.3);
        normalized.enabled = normalized.enabled !== false;
        if (!normalized.assetKey && normalized.filename && !/^(https?:\/\/|blob:|data:)/.test(normalized.filename)) {
            normalized.assetKey = createAssetKey(`legacy_${kind}`, normalized.filename);
        }
        return normalized;
    }

    function normalizeCharacter(character, options) {
        const source = character && typeof character === 'object' ? cloneData(character) : {};
        const lookup = options || {};
        const name = source.name || '旁白';
        const matchedByPath = source.voiceFile && lookup.voiceKeyByPath ? lookup.voiceKeyByPath.get(source.voiceFile) : '';
        const matchedByName = lookup.voiceKeyByName ? lookup.voiceKeyByName.get(name) : null;

        return {
            ...source,
            id: source.id || createId('char'),
            name,
            voiceFile: source.voiceFile || (matchedByName ? matchedByName.refPath : ''),
            voiceAssetKey: source.voiceAssetKey || matchedByPath || (matchedByName ? matchedByName.assetKey || '' : ''),
            volume: toNumber(source.volume, 1.0),
            voiceDescription: source.voiceDescription || (matchedByName ? matchedByName.description || '' : ''),
            voicePromptText: source.voicePromptText || (matchedByName ? matchedByName.promptText || '' : '')
        };
    }

    function inferCharactersFromLines(lines, options) {
        const roleNames = new Set();
        const lookup = options || {};

        ensureArray(lines).forEach((line) => {
            if (line && line.type === 'dialogue' && line.role) {
                roleNames.add(line.role);
            }
        });

        return Array.from(roleNames).map((roleName) => {
            const matched = lookup.voiceKeyByName ? lookup.voiceKeyByName.get(roleName) : null;
            return normalizeCharacter({
                name: roleName,
                voiceFile: matched ? matched.refPath : '',
                voiceAssetKey: matched ? matched.assetKey || '' : '',
                voiceDescription: matched ? matched.description || '' : '',
                voicePromptText: matched ? matched.promptText || '' : '',
                volume: 1.0
            }, lookup);
        });
    }

    function mergeCharacters(existingCharacters, inferredCharacters) {
        const merged = new Map();

        ensureArray(existingCharacters).forEach((character) => {
            if (character && character.name && !merged.has(character.name)) {
                merged.set(character.name, character);
            }
        });

        ensureArray(inferredCharacters).forEach((character) => {
            if (character && character.name && !merged.has(character.name)) {
                merged.set(character.name, character);
            }
        });

        return Array.from(merged.values());
    }

    function normalizeDialogueLine(line, id) {
        const source = line && typeof line === 'object' ? cloneData(line) : {};
        const trim = normalizeTrimRange(source, 0, 1);
        const nonverbalTags = normalizeVoxCpmNonverbalTags(source.voxcpm_nonverbal_tags);
        const deliveryProfile = VOXCPM_DELIVERY_PROFILES.has(source.delivery_profile)
            ? source.delivery_profile
            : 'baseline';
        const hasControlInstruction = typeof source.control_instruction === 'string'
            && source.control_instruction.trim().length > 0;
        // 旧工程无计划字段时始终落到高保真的极致克隆基线，避免导入后意外改变朗读方式。
        const cloneMode = nonverbalTags.length > 0
            || hasControlInstruction
            || (VOXCPM_CLONE_MODES.has(source.clone_mode)
            && source.clone_mode === 'controllable'
            && deliveryProfile !== 'baseline')
            ? 'controllable'
            : 'ultimate';
        const resolvedDeliveryProfile = cloneMode === 'controllable'
            ? (deliveryProfile === 'baseline' ? 'expressive' : deliveryProfile)
            : 'baseline';

        const normalized = {
            ...source,
            id,
            type: 'dialogue',
            role: source.role_name || source.role || '旁白',
            text: source.text_content || source.text || source.content || '',
            // 缺少 emotion 时回退到 Step-Audio-EditX 官方情绪词表中的中性近似标签。
            emotion: source.emotion || 'coldness',
            intensity: source.intensity || '中等',
            // VoxCPM2 表演计划独立于 IndexTTS2 的 emotion / intensity，不能混用两者的语义。
            clone_mode: cloneMode,
            delivery_profile: resolvedDeliveryProfile,
            // 括号内的自然语言表演指令与 text 分开保存，兼容可控克隆的逐句控制。
            control_instruction: typeof source.control_instruction === 'string' ? source.control_instruction.trim() : '',
            voxcpm_nonverbal_tags: nonverbalTags,
            // 极端表演只做人工试听标记，不会改变模型请求参数。
            needs_review: cloneMode === 'controllable' && (source.needs_review === true || nonverbalTags.length > 0),
            filter: source.filter || '',
            // sfx_plan 直接携带 SoundEffect 生成 WAV 的稳定资产键。
            sfx_plan: normalizeSfxPlans(source.sfx_plan, id),
            break_duration: toNumber(source.break_duration, 0),
            trimStart: trim.trimStart,
            trimEnd: trim.trimEnd,
            sfxVolume: toNumber(source.sfxVolume, 1.0),
            dialogueVolume: toNumber(source.dialogueVolume !== undefined ? source.dialogueVolume : source.volume, 1.0),
            speed: toNumber(source.speed, 1.0),
            audioAssetKey: source.audioAssetKey || `line_audio_${id}`,
            audioUrl: '',
            isGenerating: false,
            // Step-Audio-EditX 结果和原台词音频分开持久化，删除编辑结果不会影响原始合成。
            stepAudioEditXAudioAssetKey: source.stepAudioEditXAudioAssetKey || `line_step_audio_editx_${id}`,
            stepAudioEditXAudioUrl: '',
            isStepAudioEditXEditing: false
        };
        // 历史工程的 line.sfx 是素材库名称引用；当前工作流只保留生成计划。
        delete normalized.sfx;
        return normalized;
    }

    function normalizeBgmLine(line, id) {
        const source = line && typeof line === 'object' ? cloneData(line) : {};
        return {
            ...source,
            id,
            type: 'bgm',
            action: source.action || 'play',
            volume: toNumber(source.volume, 1.0),
            bgmName: source.bgmName || source.name || ''
        };
    }

    function normalizeBgImageLine(line, id) {
        const source = line && typeof line === 'object' ? cloneData(line) : {};
        return {
            ...source,
            id,
            type: 'bgImage',
            bgImagePrompt: source.bgImagePrompt || source.image_prompt || source.imagePrompt || source.prompt || '',
            bgImageAssetKey: source.bgImageAssetKey || `bgImage_${id}`,
            imageUrl: '',
            imageMimeType: source.imageMimeType || ''
        };
    }

    function normalizeScriptLine(line) {
        const source = line && typeof line === 'object' ? line : {};
        const id = source.id || createId('line');
        const type = source.type || 'dialogue';

        if (type === 'bgm') return normalizeBgmLine(source, id);
        if (type === 'bgImage') return normalizeBgImageLine(source, id);
        return normalizeDialogueLine(source, id);
    }

    function normalizeScriptEntry(script, options) {
        const source = script && typeof script === 'object' ? cloneData(script) : {};
        const data = source.data && typeof source.data === 'object' ? source.data : {};
        const lookup = options || {};
        const normalizedLines = ensureArray(data.scriptLines).map(normalizeScriptLine);

        const providedCharacters = ensureArray(data.characters).length
            ? ensureArray(data.characters)
            : ensureArray(lookup.fallbackCharacters);
        const normalizedProvidedCharacters = providedCharacters.map((character) => normalizeCharacter(character, lookup));
        const inferredCharacters = inferCharactersFromLines(normalizedLines, lookup);
        const mergedCharacters = mergeCharacters(normalizedProvidedCharacters, inferredCharacters);

        return {
            id: source.id || lookup.defaultId || createId('script'),
            name: source.name || lookup.defaultName || '脚本 1',
            data: {
                rawScript: data.rawScript || lookup.rawScript || '',
                rawAnalysisResult: data.rawAnalysisResult || lookup.rawAnalysisResult || '',
                characters: mergedCharacters,
                scriptLines: normalizedLines
            }
        };
    }

    function normalizeProjectEnvelope(rawProject) {
        const source = rawProject && typeof rawProject === 'object' ? cloneData(rawProject) : {};
        const projectSource = source.project && typeof source.project === 'object' ? source.project : source;
        const librariesSource = source.libraries && typeof source.libraries === 'object' ? source.libraries : {};

        const timbres = ensureArray(librariesSource.timbres).map((item) => normalizeLibraryItem('timbre', item));
        const voiceLookup = createVoiceLookup(timbres);
        const baseLookup = {
            timbres,
            voiceKeyByPath: voiceLookup.byPath,
            voiceKeyByName: voiceLookup.byName
        };

        let scriptListSource = ensureArray(projectSource.scriptList);
        const legacyCharacters = ensureArray(projectSource.characters || source.characters);
        const currentScriptIdCandidate = projectSource.currentScriptId || source.currentScriptId || 'default';

        if (!scriptListSource.length) {
            scriptListSource = [{
                id: currentScriptIdCandidate || 'default',
                name: '脚本 1',
                data: {
                    rawScript: projectSource.rawScript || source.rawScript || '',
                    rawAnalysisResult: projectSource.rawAnalysisResult || source.rawAnalysisResult || '',
                    characters: legacyCharacters,
                    scriptLines: projectSource.scriptLines || source.scriptLines || []
                }
            }];
        }

        const normalizedScriptList = scriptListSource.map((script, index) => normalizeScriptEntry(script, {
            ...baseLookup,
            fallbackCharacters: script && script.data && Array.isArray(script.data.characters) && script.data.characters.length
                ? []
                : (script && script.id ? (script.id === currentScriptIdCandidate ? legacyCharacters : []) : (index === 0 ? legacyCharacters : [])),
            defaultId: index === 0 ? 'default' : createId('script'),
            defaultName: `脚本 ${index + 1}`
        }));

        const currentScriptId = normalizedScriptList.some((script) => script.id === currentScriptIdCandidate)
            ? currentScriptIdCandidate
            : (normalizedScriptList[0] ? normalizedScriptList[0].id : 'default');

        return {
            kind: PROJECT_KIND,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            version: PROJECT_VERSION_LABEL,
            savedAt: toNumber(source.savedAt || source.timestamp || Date.now(), Date.now()),
            libraries: {
                bgm: ensureArray(librariesSource.bgm).map((item) => normalizeLibraryItem('bgm', item)),
                timbres,
                filters: cloneData(ensureArray(librariesSource.filters)) || [],
                emotions: cloneData(ensureArray(librariesSource.emotions)) || []
            },
            project: {
                currentScriptId,
                scriptList: normalizedScriptList
            }
        };
    }

    function stripRuntimeProjectEnvelope(rawProject) {
        const normalized = normalizeProjectEnvelope(rawProject);

        normalized.project.scriptList = normalized.project.scriptList.map((script) => ({
            ...script,
            data: {
                ...script.data,
                characters: ensureArray(script.data.characters).map((character) => {
                    const safe = cloneData(character) || {};
                    delete safe.isAnalyzing;
                    delete safe.isGeneratingVoicePrompt;
                    delete safe.isGeneratingVoice;
                    delete safe.voicePromptAbortController;
                    delete safe.abortController;
                    return safe;
                }),
                scriptLines: ensureArray(script.data.scriptLines).map((line) => {
                    const safe = cloneData(line) || {};
                    delete safe.audioUrl;
                    delete safe.stepAudioEditXAudioUrl;
                    delete safe.imageUrl;
                    delete safe.isGenerating;
                    delete safe.isStepAudioEditXEditing;
                    delete safe.abortController;
                    delete safe.stepAudioEditXAbortController;
                    return safe;
                })
            }
        }));

        return normalized;
    }

    global.UnitaleProjectStorage = {
        PROJECT_KIND,
        PROJECT_SCHEMA_VERSION,
        PROJECT_VERSION_LABEL,
        VOXCPM_NONVERBAL_TAGS: Array.from(VOXCPM_NONVERBAL_TAGS),
        cloneData,
        createId,
        sanitizeFilename,
        createAssetKey,
        normalizeVoxCpmNonverbalTags,
        normalizeProjectEnvelope,
        stripRuntimeProjectEnvelope
    };
}(window));
