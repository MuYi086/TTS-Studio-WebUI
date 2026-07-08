(function (global) {
    const PROJECT_KIND = 'unitale-project';
    const PROJECT_SCHEMA_VERSION = 3;
    const PROJECT_VERSION_LABEL = '3.0';

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
            voiceDescription: source.voiceDescription || ''
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

        return {
            ...source,
            id,
            type: 'dialogue',
            role: source.role_name || source.role || '旁白',
            text: source.text_content || source.text || source.content || '',
            emotion: source.emotion || '平静',
            intensity: source.intensity || '中等',
            filter: source.filter || '',
            sfx: ensureArray(source.sfx).map((item) => ({
                name: item && item.name ? item.name : '',
                position: toNumber(item && item.position, 0)
            })),
            break_duration: toNumber(source.break_duration, 0),
            trimStart: trim.trimStart,
            trimEnd: trim.trimEnd,
            sfxVolume: toNumber(source.sfxVolume, 1.0),
            dialogueVolume: toNumber(source.dialogueVolume !== undefined ? source.dialogueVolume : source.volume, 1.0),
            speed: toNumber(source.speed, 1.0),
            audioAssetKey: source.audioAssetKey || `line_audio_${id}`,
            audioUrl: '',
            isGenerating: false
        };
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
                sfx: ensureArray(librariesSource.sfx).map((item) => normalizeLibraryItem('sfx', item)),
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
                    delete safe.isGeneratingVoice;
                    delete safe.abortController;
                    return safe;
                }),
                scriptLines: ensureArray(script.data.scriptLines).map((line) => {
                    const safe = cloneData(line) || {};
                    delete safe.audioUrl;
                    delete safe.imageUrl;
                    delete safe.isGenerating;
                    delete safe.abortController;
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
        cloneData,
        createId,
        sanitizeFilename,
        createAssetKey,
        normalizeProjectEnvelope,
        stripRuntimeProjectEnvelope
    };
}(window));
