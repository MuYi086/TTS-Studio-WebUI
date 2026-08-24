/** @fileoverview 音频导出结果的浏览器下载与短期重复保护。 */
(function (global) {
    const DEFAULT_DEDUPE_WINDOW_MS = 120000;

    function createResultKey(settings) {
        return [
            settings.profile || 'unknown',
            settings.outputFormat || 'unknown',
            settings.filename,
            settings.blob.type || 'application/octet-stream',
            settings.blob.size
        ].join(':');
    }

    /**
     * 创建页面级下载协调器；相同结果在短期内默认只触发一次浏览器下载。
     * @param {Object} [options] 协调器配置
     * @param {Window|Object} [options.browser] 浏览器对象；测试可传入替身
     * @param {number} [options.dedupeWindowMs] 重复结果保护窗口
     * @param {Function} [options.now] 当前时间函数；测试可传入固定时钟
     * @returns {{downloadOnce: Function}} 下载入口
     */
    function createCoordinator(options = {}) {
        const browser = options.browser || global;
        const now = typeof options.now === 'function' ? options.now : () => Date.now();
        const configuredWindow = Number(options.dedupeWindowMs);
        const dedupeWindowMs = Number.isFinite(configuredWindow) && configuredWindow >= 0
            ? configuredWindow
            : DEFAULT_DEDUPE_WINDOW_MS;
        const recentDownloads = new Map();

        function pruneExpiredDownloads(currentTime) {
            recentDownloads.forEach((downloadedAt, key) => {
                if (currentTime - downloadedAt > dedupeWindowMs) recentDownloads.delete(key);
            });
        }

        /**
         * 触发一次浏览器下载；近期相同结果返回 false，除非用户明确允许重复。
         * @param {Object} settings 下载设置
         * @param {Blob} settings.blob 音频成品
         * @param {string} settings.filename 下载文件名
         * @param {string} settings.profile 导出档位
         * @param {string} settings.outputFormat 导出格式
         * @param {boolean} [settings.allowDuplicate] 是否明确允许重复保存
         * @returns {boolean} 是否实际触发下载
         */
        function downloadOnce(settings) {
            if (!settings || !(settings.blob instanceof Blob) || !settings.blob.size) {
                throw new Error('待下载的音频成品不能为空。');
            }
            if (!settings.filename) throw new Error('音频成品缺少下载文件名。');
            const currentTime = now();
            pruneExpiredDownloads(currentTime);
            const resultKey = createResultKey(settings);
            if (!settings.allowDuplicate && recentDownloads.has(resultKey)) return false;

            recentDownloads.set(resultKey, currentTime);
            const url = browser.URL.createObjectURL(settings.blob);
            const anchor = browser.document.createElement('a');
            anchor.href = url;
            anchor.download = settings.filename;
            browser.document.body.appendChild(anchor);
            try {
                anchor.click();
            } finally {
                browser.document.body.removeChild(anchor);
                browser.URL.revokeObjectURL(url);
            }
            return true;
        }

        return Object.freeze({ downloadOnce });
    }

    const api = { createCoordinator };
    global.UnitaleAudioExportDownload = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
