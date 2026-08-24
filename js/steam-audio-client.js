/** @fileoverview 8300 Steam Audio 对象级正式导出客户端。 */
(function (global) {
    const API_URL = 'http://127.0.0.1:8300/v1/audio/spatial/render';
    const DEFAULT_POLL_INTERVAL_MS = 750;

    function createJobId() {
        const randomId = global.crypto && typeof global.crypto.randomUUID === 'function'
            ? global.crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        return `job-${randomId}`;
    }

    function notifyProgress(callback, snapshot) {
        if (typeof callback !== 'function') return;
        callback({
            ...snapshot,
            progress: Math.max(0, Math.min(100, Number(snapshot.progress) || 0))
        });
    }

    async function pollRenderProgress(settings, jobId, isActive) {
        const fetchImpl = settings.fetchImpl || global.fetch;
        const interval = Math.max(1, Number(settings.pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);
        const renderUrl = settings.url || API_URL;
        const progressUrl = settings.progressUrl
            || `${renderUrl}/progress/${encodeURIComponent(jobId)}`;
        while (isActive()) {
            try {
                const response = await fetchImpl(progressUrl, { signal: settings.signal });
                if (response.ok) {
                    const snapshot = await response.json();
                    notifyProgress(settings.onProgress, snapshot);
                    if (snapshot.state === 'succeeded' || snapshot.state === 'failed') return;
                } else if (response.status !== 404) {
                    console.warn(`查询 Steam Audio 进度失败：HTTP ${response.status}`);
                }
            } catch (error) {
                if (error && error.name === 'AbortError') return;
                console.warn('查询 Steam Audio 进度失败。', error);
            }
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    }

    function responseFilename(response, outputFormat) {
        const disposition = response.headers.get('content-disposition') || '';
        const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const plain = disposition.match(/filename="?([^";]+)"?/i);
        try {
            if (encoded) return decodeURIComponent(encoded[1]);
        } catch (error) {
            console.warn('无法解码正式空间音频文件名。', error);
        }
        return plain ? plain[1] : `unitale_steam_export.${outputFormat}`;
    }

    /** 上传 Manifest 和未混合对象，返回最终 48 kHz 双声道文件。 */
    async function renderSpatialAudio(options) {
        const settings = options || {};
        const fetchImpl = settings.fetchImpl || global.fetch;
        if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持 fetch。');
        if (!settings.manifest || !Array.isArray(settings.assets) || settings.assets.length === 0) {
            throw new Error('正式空间导出缺少 Manifest 或独立音频对象。');
        }
        const profile = ['balanced', 'immersive'].includes(settings.profile) ? settings.profile : 'balanced';
        const outputFormat = settings.outputFormat === 'mp3' ? 'mp3' : 'wav';
        const jobId = settings.jobId || createJobId();
        const form = new FormData();
        form.append('manifest', JSON.stringify(settings.manifest));
        form.append('profile', profile);
        form.append('output_format', outputFormat);
        form.append('job_id', jobId);
        settings.assets.forEach((asset) => {
            const uploadFilename = asset.asset_filename || asset.filename;
            if (!(asset.blob instanceof Blob) || !asset.blob.size || !uploadFilename) {
                throw new Error(`独立音频对象无效：${asset.assetKey || asset.filename || 'unknown'}`);
            }
            // multipart 文件名必须与 Manifest.asset_filename 一致，原始名只用于界面展示。
            form.append('assets', asset.blob, uploadFilename);
        });

        let progressActive = true;
        notifyProgress(settings.onProgress, {
            job_id: jobId,
            state: 'uploading',
            stage: 'uploading',
            progress: 0,
            message: `正在上传 ${settings.assets.length} 个独立音频对象`
        });
        if (typeof settings.onProgress === 'function') {
            void pollRenderProgress(settings, jobId, () => progressActive);
        }
        try {
            const response = await fetchImpl(settings.url || API_URL, {
                method: 'POST', body: form, signal: settings.signal
            });
            if (!response.ok) {
                const detail = await response.text();
                notifyProgress(settings.onProgress, {
                    job_id: jobId,
                    state: 'failed',
                    stage: 'failed',
                    progress: 0,
                    message: `正式导出失败（HTTP ${response.status}）`
                });
                throw new Error(`Steam Audio 正式导出失败（HTTP ${response.status}）：${detail.slice(0, 500) || '服务未返回详情'}`);
            }
            const expectedType = outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
            const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
            if (contentType !== expectedType) {
                const detail = await response.text();
                throw new Error(`Steam Audio 返回类型异常：${detail.slice(0, 300) || contentType || 'unknown'}`);
            }
            const requiredHeaders = {
                'x-spatial-engine': 'steam-audio',
                'x-spatial-manifest-version': '1.0',
                'x-audio-sample-rate': '48000',
                'x-audio-profile': profile,
                'x-audio-format': outputFormat,
                'x-spatial-job-id': jobId
            };
            Object.entries(requiredHeaders).forEach(([name, expected]) => {
                if ((response.headers.get(name) || '').toLowerCase() !== expected.toLowerCase()) {
                    throw new Error(`Steam Audio 响应头 ${name} 不符合合同。`);
                }
            });
            const blob = await response.blob();
            if (!blob.size) throw new Error('Steam Audio 服务返回了空文件。');
            notifyProgress(settings.onProgress, {
                job_id: jobId,
                state: 'succeeded',
                stage: 'completed',
                progress: 100,
                message: '渲染完成，正在下载文件'
            });
            return { blob, filename: responseFilename(response, outputFormat), jobId };
        } finally {
            progressActive = false;
        }
    }

    const api = { API_URL, createJobId, renderSpatialAudio };
    global.UnitaleSteamAudioClient = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
