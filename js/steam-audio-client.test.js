const assert = require('node:assert/strict');
const test = require('node:test');

const client = require('./steam-audio-client.js');

function headers(overrides) {
    return new Headers({
        'content-type': 'audio/wav',
        'content-disposition': 'attachment; filename="formal.wav"',
        'x-spatial-engine': 'steam-audio',
        'x-spatial-manifest-version': '1.0',
        'x-audio-sample-rate': '48000',
        'x-audio-profile': 'balanced',
        'x-audio-format': 'wav',
        'x-spatial-job-id': 'job-12345678',
        ...overrides
    });
}

test('正式客户端以重复 assets 字段上传独立 Blob 并验证响应合同', async () => {
    let request;
    const result = await client.renderSpatialAudio({
        manifest: { version: '1.0' },
        assets: [
            { assetKey: 'a', filename: 'a.wav', blob: new Blob(['a'], { type: 'audio/wav' }) },
            { assetKey: 'b', filename: 'b.wav', blob: new Blob(['b'], { type: 'audio/wav' }) }
        ],
        profile: 'balanced',
        outputFormat: 'wav',
        jobId: 'job-12345678',
        fetchImpl: async (url, options) => {
            request = { url, options };
            return new Response(new Blob(['wav'], { type: 'audio/wav' }), { status: 200, headers: headers() });
        }
    });
    assert.equal(request.url, client.API_URL);
    assert.equal(request.options.body.getAll('assets').length, 2);
    assert.equal(request.options.body.get('profile'), 'balanced');
    assert.equal(result.filename, 'formal.wav');
    assert.ok(result.blob.size > 0);
});

test('上传文件名使用 Manifest 资产名而不是原始展示名', async () => {
    await client.renderSpatialAudio({
        manifest: {
            version: '1.0',
            sources: [{ asset_filename: 'asset_deadbeef.wav' }]
        },
        assets: [{
            assetKey: 'dialogue-key',
            asset_filename: 'asset_deadbeef.wav',
            filename: 'fireredtts3_clone_original.wav',
            blob: new Blob(['voice'], { type: 'audio/wav' })
        }],
        jobId: 'job-12345678',
        fetchImpl: async (_url, options) => {
            const [uploaded] = options.body.getAll('assets');
            assert.equal(uploaded.name, 'asset_deadbeef.wav');
            return new Response(new Blob(['wav'], { type: 'audio/wav' }), {
                status: 200,
                headers: headers()
            });
        }
    });
});

test('响应缺少 renderer 身份头时拒绝把文件当作成功结果', async () => {
    await assert.rejects(() => client.renderSpatialAudio({
        manifest: { version: '1.0' },
        assets: [{ filename: 'a.wav', blob: new Blob(['a']) }],
        jobId: 'job-12345678',
        fetchImpl: async () => new Response(new Blob(['wav']), {
            status: 200,
            headers: headers({ 'x-spatial-engine': 'legacy-ffmpeg' })
        })
    }), /x-spatial-engine/);
});

test('AbortSignal 原样传给 fetch，取消不会被改写成后端已停止', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => client.renderSpatialAudio({
        manifest: { version: '1.0' },
        assets: [{ filename: 'a.wav', blob: new Blob(['a']) }],
        jobId: 'job-12345678',
        signal: controller.signal,
        fetchImpl: async (_url, options) => {
            assert.equal(options.signal, controller.signal);
            throw new DOMException('aborted', 'AbortError');
        }
    }), (error) => error.name === 'AbortError');
});

test('正式渲染提交 job_id 并轮询后端真实进度', async () => {
    let releaseRender;
    const renderResponse = new Promise((resolve) => { releaseRender = resolve; });
    const progressUpdates = [];
    const requests = [];
    const rendering = client.renderSpatialAudio({
        manifest: { version: '1.0' },
        assets: [{ filename: 'a.wav', blob: new Blob(['a']) }],
        jobId: 'job-12345678',
        pollIntervalMs: 1,
        onProgress: (progress) => progressUpdates.push(progress),
        fetchImpl: async (url, options = {}) => {
            requests.push({ url, options });
            if ((options.method || 'GET') === 'POST') return renderResponse;
            return new Response(JSON.stringify({
                job_id: 'job-12345678',
                state: 'running',
                stage: 'rendering',
                progress: 70,
                message: '正在渲染 2/3 个对象'
            }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    releaseRender(new Response(new Blob(['wav'], { type: 'audio/wav' }), {
        status: 200,
        headers: headers()
    }));
    await rendering;

    const postRequest = requests.find((request) => request.options.method === 'POST');
    assert.equal(postRequest.options.body.get('job_id'), 'job-12345678');
    assert.ok(requests.some((request) => request.url.endsWith('/progress/job-12345678')));
    assert.ok(progressUpdates.some((progress) => progress.progress === 70));
    assert.equal(progressUpdates.at(-1).state, 'succeeded');
});
