/**
 * @fileoverview 本地空间音频导出客户端。
 * 只负责把浏览器混音上传至 8300 控制面，并校验最终 WAV/MP3 响应。
 */
(function (global) {
    const DEFAULT_ENDPOINT = 'http://127.0.0.1:8300/v1/audio/export';
    const DEFAULT_PROFILE = 'balanced';
    const DEFAULT_FORMAT = 'wav';

    const EXPORT_PROFILES = Object.freeze({
        standard: Object.freeze({ id: 'standard', label: '标准立体声' }),
        balanced: Object.freeze({ id: 'balanced', label: '均衡空间感' }),
        immersive: Object.freeze({ id: 'immersive', label: '沉浸空间感' })
    });
    const EXPORT_FORMATS = Object.freeze({
        wav: Object.freeze({ id: 'wav', label: 'WAV 24-bit' }),
        mp3: Object.freeze({ id: 'mp3', label: 'MP3 192 kbps' })
    });

    /**
     * 从 Content-Disposition 响应头读取安全的下载文件名。
     * @param {string|null} disposition Content-Disposition 响应头
     * @returns {string} 下载文件名；无法解析时返回空字符串
     */
    function parseDownloadFilename(disposition) {
        if (!disposition) return '';
        const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (encodedMatch) {
            try {
                return decodeURIComponent(encodedMatch[1].trim());
            } catch (error) {
                console.warn('无法解码空间音频下载文件名。', error);
            }
        }
        const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
        return plainMatch ? plainMatch[1].trim() : '';
    }

    /**
     * 将 48 kHz 浏览器混音交给后端完成空间化、响度归一化和最终编码。
     * @param {Object} options 请求选项
     * @param {Blob} options.audio 浏览器离线渲染得到的 WAV
     * @param {string} [options.profile] 空间化档位
     * @param {string} [options.outputFormat] 最终文件格式
     * @param {AbortSignal} [options.signal] 可选取消信号
     * @param {string} [options.endpoint] 覆盖服务地址，仅供本地调试
     * @returns {Promise<{blob: Blob, filename: string, sampleRate: number|null, profile: string, outputFormat: string}>} 最终导出文件及元数据
     */
    async function exportSpatialAudio({
        audio,
        profile = DEFAULT_PROFILE,
        outputFormat = DEFAULT_FORMAT,
        signal,
        endpoint
    }) {
        if (!(audio instanceof Blob) || audio.size === 0) {
            throw new Error('待导出的浏览器混音不能为空。');
        }
        if (!EXPORT_PROFILES[profile]) throw new Error(`不支持的空间化档位：${profile}`);
        if (!EXPORT_FORMATS[outputFormat]) throw new Error(`不支持的导出格式：${outputFormat}`);

        const formData = new FormData();
        formData.append('audio', audio, 'unitale_timeline_mix.wav');
        formData.append('profile', profile);
        formData.append('output_format', outputFormat);

        const response = await fetch(endpoint || DEFAULT_ENDPOINT, {
            method: 'POST',
            body: formData,
            signal
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`空间音频处理失败（HTTP ${response.status}）：${detail.slice(0, 500) || '服务未返回详情'}`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('audio/')) {
            const detail = await response.text();
            throw new Error(`空间音频服务未返回音频：${detail.slice(0, 500) || contentType || '未知响应'}`);
        }

        const blob = await response.blob();
        if (!blob.size) throw new Error('空间音频服务返回了空文件。');
        const sampleRateHeader = response.headers.get('X-Audio-Sample-Rate');
        return {
            blob,
            filename: parseDownloadFilename(response.headers.get('content-disposition')),
            sampleRate: sampleRateHeader == null ? null : Number(sampleRateHeader),
            profile: response.headers.get('X-Audio-Profile') || profile,
            outputFormat: response.headers.get('X-Audio-Format') || outputFormat
        };
    }

    global.UnitaleSpatialAudioClient = {
        DEFAULT_ENDPOINT,
        DEFAULT_PROFILE,
        DEFAULT_FORMAT,
        EXPORT_PROFILES,
        EXPORT_FORMATS,
        exportSpatialAudio
    };
}(window));
