/**
 * @fileoverview ACE-Step AI BGM generation client.
 */
(function (global) {
    const ACE_STEP_MODEL = Object.freeze({
        id: 'ace_step_1_5',
        label: 'ACE-Step 1.5 XL Turbo',
        endpoint: 'http://127.0.0.1:8313/v1/aceStep/bgm',
        minSeconds: 10,
        maxSeconds: 600,
        defaultSeconds: 60,
        defaultSteps: 8,
        promptLanguage: 'en'
    });

    const BGM_MODELS = Object.freeze({
        ace_step_1_5: ACE_STEP_MODEL
    });

    const DEFAULT_MODEL = 'ace_step_1_5';
    const MODEL_ALIASES = Object.freeze({
        // 兼容旧版页面状态或工程元数据中的内部 checkpoint 名称；新界面只暴露产品模型 ID。
        'ace-step-v15-xl-turbo-diffusers': DEFAULT_MODEL
    });

    function getBgmModel(model) {
        const modelId = MODEL_ALIASES[model] || model;
        return BGM_MODELS[modelId] || BGM_MODELS[DEFAULT_MODEL];
    }

    function optionalNumber(value, label) {
        if (value === '' || value == null) return null;
        const number = Number(value);
        if (!Number.isFinite(number)) {
            throw new Error(`${label} 必须是数字。`);
        }
        return number;
    }

    /**
     * Generate one BGM WAV from the ACE-Step service.
     *
     * @param {Object} options - Request options.
     * @returns {Promise<{blob: Blob, seed: number|null, sampleRate: number|null, model: string}>}
     */
    async function generateBgmAudio({
        prompt,
        seconds = 60,
        bpm,
        keyscale,
        timesignature,
        seed = -1,
        steps = 8,
        model = DEFAULT_MODEL,
        signal,
        endpoint
    }) {
        const config = getBgmModel(model);
        const normalizedPrompt = String(prompt || '').trim();
        if (!normalizedPrompt) {
            throw new Error(`${config.label} Prompt 不能为空。`);
        }

        const normalizedSeconds = optionalNumber(seconds, 'BGM 时长');
        if (normalizedSeconds < config.minSeconds || normalizedSeconds > config.maxSeconds) {
            throw new Error(`BGM 时长必须在 ${config.minSeconds}–${config.maxSeconds} 秒之间。`);
        }

        const normalizedSteps = optionalNumber(steps, '推理步数');
        if (!Number.isInteger(normalizedSteps) || normalizedSteps < 1 || normalizedSteps > 20) {
            throw new Error('推理步数必须是 1–20 之间的整数。');
        }

        const normalizedSeed = optionalNumber(seed, 'Seed');
        if (!Number.isInteger(normalizedSeed)) {
            throw new Error('Seed 必须是整数。');
        }

        const payload = {
            prompt: normalizedPrompt,
            seconds: normalizedSeconds,
            steps: normalizedSteps,
            seed: normalizedSeed
        };

        const normalizedBpm = optionalNumber(bpm, 'BPM');
        if (normalizedBpm != null) {
            if (!Number.isInteger(normalizedBpm) || normalizedBpm < 30 || normalizedBpm > 240) {
                throw new Error('BPM 必须是 30–240 之间的整数。');
            }
            payload.bpm = normalizedBpm;
        }
        if (keyscale && String(keyscale).trim()) payload.keyscale = String(keyscale).trim();
        if (timesignature && String(timesignature).trim()) {
            payload.timesignature = String(timesignature).trim();
        }

        const response = await fetch(endpoint || config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(
                `${config.label} 生成失败 (HTTP ${response.status})：${detail.slice(0, 500)}`
            );
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.startsWith('audio/')) {
            throw new Error(`${config.label} 未返回音频（Content-Type: ${contentType || '未知'}）。`);
        }

        const blob = await response.blob();
        if (!blob.size) throw new Error(`${config.label} 返回空音频。`);

        const seedHeader = response.headers.get('X-ACE-Step-Seed');
        const sampleRateHeader = response.headers.get('X-ACE-Step-Sample-Rate');
        return {
            blob,
            seed: seedHeader == null ? null : Number(seedHeader),
            sampleRate: sampleRateHeader == null ? null : Number(sampleRateHeader),
            model: response.headers.get('X-ACE-Step-Model') || config.id
        };
    }

    global.UnitaleBgmClient = {
        BGM_MODELS,
        DEFAULT_MODEL,
        getBgmModel,
        generateBgmAudio
    };
}(window));
