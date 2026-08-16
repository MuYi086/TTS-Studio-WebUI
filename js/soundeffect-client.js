/**
 * @fileoverview 本地 SoundEffect 浏览器客户端。
 * 只负责模型路由、HTTP 请求与 WAV 响应校验；时间轴状态、IndexedDB 和 UI 由 index.html 管理。
 */
(function (global) {
    const SOUND_EFFECT_MODELS = Object.freeze({
        'moss-soundEffect-v2': Object.freeze({
            id: 'moss-soundEffect-v2',
            label: 'MOSS-SoundEffect v2',
            endpoint: 'http://127.0.0.1:8312/v1/moss/soundEffect',
            maxSeconds: 30,
            promptLanguage: 'zh-CN'
        }),
        'stable-audio-3-medium': Object.freeze({
            id: 'stable-audio-3-medium',
            label: 'Stable Audio 3 Medium',
            endpoint: 'http://127.0.0.1:8311/v1/stableAudio/soundEffect',
            maxSeconds: 380,
            promptLanguage: 'en'
        })
    });
    const DEFAULT_MODEL = 'stable-audio-3-medium';
    const DEFAULT_ENDPOINT = SOUND_EFFECT_MODELS[DEFAULT_MODEL].endpoint;

    /**
     * 获取已注册的音效模型，未知值降级到默认 Medium 以兼容已移除的旧模型标识。
     * @param {string} model 模型标识
     * @returns {Object} 模型请求配置
     */
    function getSoundEffectModel(model) {
        return SOUND_EFFECT_MODELS[model] || SOUND_EFFECT_MODELS[DEFAULT_MODEL];
    }

    /**
     * 请求选定的本地模型生成一条非语言音效。
     * @param {Object} options 请求选项
     * @param {string} options.prompt 可直接用于 SoundEffect 的具体非语言声效描述
     * @param {number} options.seconds 目标时长；上限由所选模型决定
     * @param {string} [options.model] 音效模型标识
     * @param {AbortSignal} [options.signal] 可选取消信号
     * @param {string} [options.endpoint] 覆盖当前模型的服务地址，仅供本地调试
     * @returns {Promise<Blob>} 返回的 WAV 数据
     */
    async function generateSoundEffectAudio({ prompt, seconds, model = DEFAULT_MODEL, signal, endpoint }) {
        const modelConfig = getSoundEffectModel(model);
        const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
        if (!normalizedPrompt) throw new Error(`${modelConfig.label} 提示词不能为空。`);

        const requestedSeconds = Number(seconds);
        const normalizedSeconds = Number.isFinite(requestedSeconds) && requestedSeconds > 0
            ? Math.min(modelConfig.maxSeconds, requestedSeconds)
            : 1;
        const response = await fetch(endpoint || modelConfig.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: normalizedPrompt, seconds: normalizedSeconds }),
            signal
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`${modelConfig.label} 生成失败（HTTP ${response.status}）：${detail.slice(0, 500) || '服务未返回详情'}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('audio/')) {
            const detail = await response.text();
            throw new Error(`${modelConfig.label} 未返回音频：${detail.slice(0, 500) || contentType}`);
        }

        const audio = await response.blob();
        if (audio.size === 0) throw new Error(`${modelConfig.label} 返回了空音频。`);
        return audio;
    }

    global.UnitaleSoundEffectClient = {
        SOUND_EFFECT_MODELS,
        DEFAULT_MODEL,
        DEFAULT_ENDPOINT,
        getSoundEffectModel,
        generateSoundEffectAudio
    };
}(window));
