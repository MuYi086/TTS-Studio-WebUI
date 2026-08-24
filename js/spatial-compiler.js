/**
 * @fileoverview 将工程 schema v4 的语义空间计划确定性编译为 Render Manifest v1。
 */
(function (global) {
    const spatialSchema = global.UnitaleSpatialSchema
        || (typeof require === 'function' ? require('./spatial-schema.js') : null);
    if (!spatialSchema) throw new Error('spatial-schema.js 必须先加载');

    const MIX_GAINS = Object.freeze({
        cue_before_dialogue: 0.22,
        action_under_dialogue: 0.3,
        soft_ambience: 0.12,
        transition: 0.25
    });

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const asNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const ms = (seconds) => Math.max(0, Math.round(seconds * 1000));
    const gainToDb = (gain) => clamp(20 * Math.log10(Math.max(0.001, gain)), -60, 12);

    function hashKey(value) {
        let hash = 2166136261;
        for (const char of String(value)) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function readAsset(catalog, key) {
        if (!key) return null;
        return catalog instanceof Map ? catalog.get(key) || null : catalog[key] || null;
    }

    function sfxOffsetMs(plan, dialogueDurationMs) {
        const offset = clamp(Math.round(asNumber(plan && plan.offset_ms, 0)), -500, 5000);
        return ['dialogue_end', 'break_start'].includes(plan && plan.anchor)
            ? dialogueDurationMs + offset
            : offset;
    }

    function sfxPreRollMs(plans) {
        return (plans || []).reduce((result, plan) => {
            if (!plan || plan.anchor !== 'dialogue_start') return result;
            return Math.max(result, -Math.min(0, sfxOffsetMs(plan, 0)));
        }, 0);
    }

    function findBgmItem(line, library) {
        return (library || []).find((item) => (
            (line.audioAssetKey && item.assetKey === line.audioAssetKey)
            || (!line.audioAssetKey && line.bgmName && item.name === line.bgmName)
        )) || null;
    }

    function createAssetIdentity(assetKey) {
        const token = hashKey(assetKey);
        return { asset_id: `asset_${token}`, asset_filename: `asset_${token}.wav` };
    }

    /**
     * 编译对象级正式导出；结果中的 assetRequests 用于从 IndexedDB 逐个加载 Blob。
     * @param {Object} options 工程、资产时长和导出配置
     * @returns {{manifest: Object, assetRequests: Array<Object>}} Manifest 与独立上传清单
     */
    function compileRenderManifest(options) {
        const settings = options || {};
        const lines = Array.isArray(settings.scriptLines) ? settings.scriptLines : [];
        const characters = Array.isArray(settings.characters) ? settings.characters : [];
        const bgmLibrary = Array.isArray(settings.bgmLibrary) ? settings.bgmLibrary : [];
        const assets = settings.assetsByKey || {};
        const profile = ['balanced', 'immersive'].includes(settings.profile) ? settings.profile : 'balanced';
        const roleOrder = [];
        lines.forEach((line) => {
            if (line && line.type === 'dialogue' && line.role && !roleOrder.includes(line.role)) roleOrder.push(line.role);
        });

        let cursorMs = 0;
        let currentBgm = null;
        let sourceIndex = 0;
        let tailMs = 0;
        const sources = [];
        const bgmSegments = [];
        const requestedAssets = new Map();

        const appendSource = (source, assetKey, asset) => {
            const identity = createAssetIdentity(assetKey);
            sourceIndex += 1;
            sources.push({ id: `source_${String(sourceIndex).padStart(4, '0')}`, ...identity, ...source });
            requestedAssets.set(assetKey, { assetKey, ...identity, filename: asset.filename || '' });
            tailMs = Math.max(tailMs, source.start_ms + source.duration_ms);
        };

        for (const line of lines) {
            if (!line) continue;
            if (line.type === 'bgm') {
                if (line.action === 'play') {
                    if (currentBgm) bgmSegments.push({ ...currentBgm, endMs: cursorMs });
                    const item = findBgmItem(line, bgmLibrary) || line;
                    const assetKey = line.audioAssetKey || item.assetKey || '';
                    currentBgm = { line, item, assetKey, startMs: cursorMs };
                } else if (line.action === 'stop' && currentBgm) {
                    bgmSegments.push({ ...currentBgm, endMs: cursorMs });
                    currentBgm = null;
                }
                continue;
            }
            if (line.type !== 'dialogue') continue;
            const asset = readAsset(assets, line.audioAssetKey);
            if (asset) {
                const trimStart = clamp(asNumber(line.trimStart, 0), 0, 1);
                const trimEnd = clamp(asNumber(line.trimEnd, 1), trimStart + 0.001, 1);
                const speed = clamp(asNumber(line.speed, 1), 0.5, 2);
                const sourceDurationMs = Math.max(1, Math.round(asNumber(asset.durationMs, 0) * (trimEnd - trimStart)));
                const outputDurationMs = Math.max(1, Math.round(sourceDurationMs / speed));
                const generatedPlans = (line.sfx_plan || []).filter((plan) => readAsset(assets, plan && plan.audioAssetKey));
                cursorMs += 50 + sfxPreRollMs(generatedPlans);
                const roleIndex = Math.max(0, roleOrder.indexOf(line.role));
                const kind = line.role === '旁白' || /^narrator$/i.test(line.role || '') ? 'narrator' : 'dialogue';
                const character = characters.find((item) => item && item.name === line.role);
                appendSource({
                    kind,
                    start_ms: cursorMs,
                    trim_start_ms: Math.round(asNumber(asset.durationMs, 0) * trimStart),
                    duration_ms: outputDurationMs,
                    playback_rate: speed,
                    gain_db: gainToDb(asNumber(line.dialogueVolume, 1) * asNumber(character && character.volume, 1)),
                    loop: false,
                    spatial: spatialSchema.normalizeSpatialPlan(kind, line.spatial, { role: line.role, roleIndex })
                }, line.audioAssetKey, asset);

                for (const plan of generatedPlans) {
                    const sfxAsset = readAsset(assets, plan.audioAssetKey);
                    const startMs = Math.max(0, cursorMs + sfxOffsetMs(plan, outputDurationMs));
                    const sfxDurationMs = Math.max(1, Math.round(asNumber(sfxAsset.durationMs, 0)));
                    appendSource({
                        kind: plan.purpose === 'ambience' ? 'ambience' : 'sfx',
                        start_ms: startMs,
                        trim_start_ms: 0,
                        duration_ms: sfxDurationMs,
                        playback_rate: 1,
                        gain_db: gainToDb(asNumber(line.sfxVolume, 1) * (MIX_GAINS[plan.mix_preset] || 0.3)),
                        loop: false,
                        spatial: spatialSchema.normalizeSpatialPlan(
                            plan.purpose === 'ambience' ? 'ambience' : 'sfx',
                            plan.spatial
                        )
                    }, plan.audioAssetKey, sfxAsset);
                }
                cursorMs += outputDurationMs;
            }
            cursorMs += ms(asNumber(line.break_duration, 0));
        }
        if (currentBgm) bgmSegments.push({ ...currentBgm, endMs: cursorMs + 2000 });

        for (const segment of bgmSegments) {
            const asset = readAsset(assets, segment.assetKey);
            const durationMs = Math.max(0, segment.endMs - segment.startMs);
            if (!asset || durationMs < 1) continue;
            const trimStart = clamp(asNumber(segment.item.trimStart, 0), 0, 1);
            appendSource({
                kind: 'bgm',
                start_ms: segment.startMs,
                trim_start_ms: Math.round(asNumber(asset.durationMs, 0) * trimStart),
                duration_ms: durationMs,
                playback_rate: 1,
                gain_db: gainToDb(asNumber(segment.line.volume, 1) * asNumber(segment.item.volume, 1)),
                loop: true,
                spatial: spatialSchema.normalizeSpatialPlan('bgm', segment.line.spatial || segment.item.spatial)
            }, segment.assetKey, asset);
        }

        if (sources.length === 0) throw new Error('没有可用于正式空间导出的独立音频对象。');
        const timelineDurationMs = Math.max(cursorMs, tailMs) + 1000;
        return {
            manifest: {
                version: '1.0',
                sample_rate: 48000,
                timeline_duration_ms: timelineDurationMs,
                scene: {
                    room: settings.room || 'dry_studio',
                    listener_pose: 'center_forward',
                    acoustic_quality: profile
                },
                sources
            },
            assetRequests: Array.from(requestedAssets.values())
        };
    }

    const api = { MIX_GAINS, compileRenderManifest, gainToDb, sfxOffsetMs, sfxPreRollMs };
    global.UnitaleSpatialCompiler = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
