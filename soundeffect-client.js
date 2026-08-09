/**
 * @fileoverview MOSS-SoundEffect v2 浏览器客户端。
 * 只负责 8311 请求与 WAV 响应校验；时间轴状态、IndexedDB 和 UI 由 index.html 管理。
 */
(function (global) {
    const DEFAULT_ENDPOINT = 'http://127.0.0.1:8311/v1/generate';

    /**
     * 请求 MOSS-SoundEffect 生成一条非语言音效。
     * @param {Object} options 请求选项
     * @param {string} options.prompt 可直接用于 SoundEffect 的具体非语言声效描述
     * @param {number} options.seconds 目标时长，范围为 (0, 30]
     * @param {AbortSignal} [options.signal] 可选取消信号
     * @param {string} [options.endpoint] SoundEffect 服务地址
     * @returns {Promise<Blob>} 返回的 WAV 数据
     */
    async function generateSoundEffectAudio({ prompt, seconds, signal, endpoint = DEFAULT_ENDPOINT }) {
        const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
        if (!normalizedPrompt) throw new Error('SoundEffect 提示词不能为空。');

        const requestedSeconds = Number(seconds);
        const normalizedSeconds = Number.isFinite(requestedSeconds) && requestedSeconds > 0
            ? Math.min(30, requestedSeconds)
            : 1;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: normalizedPrompt, seconds: normalizedSeconds }),
            signal
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`SoundEffect 生成失败（HTTP ${response.status}）：${detail.slice(0, 500) || '服务未返回详情'}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('audio/')) {
            const detail = await response.text();
            throw new Error(`SoundEffect 未返回音频：${detail.slice(0, 500) || contentType}`);
        }

        const audio = await response.blob();
        if (audio.size === 0) throw new Error('SoundEffect 返回了空音频。');
        return audio;
    }

    global.UnitaleSoundEffectClient = {
        DEFAULT_ENDPOINT,
        generateSoundEffectAudio
    };
}(window));
