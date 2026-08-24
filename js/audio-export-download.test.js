const assert = require('node:assert/strict');
const test = require('node:test');

const audioExportDownload = require('./audio-export-download.js');

function createBrowserHarness() {
    const calls = {
        appended: 0,
        clicked: 0,
        createdUrls: 0,
        removed: 0,
        revokedUrls: 0
    };
    const anchor = {
        click() { calls.clicked += 1; },
        download: '',
        href: ''
    };
    const browser = {
        URL: {
            createObjectURL() {
                calls.createdUrls += 1;
                return `blob:test/${calls.createdUrls}`;
            },
            revokeObjectURL() { calls.revokedUrls += 1; }
        },
        document: {
            body: {
                appendChild() { calls.appended += 1; },
                removeChild() { calls.removed += 1; }
            },
            createElement(tagName) {
                assert.equal(tagName, 'a');
                return anchor;
            }
        }
    };
    return { anchor, browser, calls };
}

test('相同导出结果在去重窗口内只触发一次浏览器下载', () => {
    const { browser, calls } = createBrowserHarness();
    const coordinator = audioExportDownload.createCoordinator({
        browser,
        dedupeWindowMs: 120000,
        now: () => 1000
    });
    const result = {
        blob: new Blob(['same-result'], { type: 'audio/wav' }),
        filename: 'unitale.wav',
        profile: 'balanced',
        outputFormat: 'wav'
    };

    assert.equal(coordinator.downloadOnce(result), true);
    assert.equal(coordinator.downloadOnce(result), false);
    assert.deepEqual(calls, {
        appended: 1,
        clicked: 1,
        createdUrls: 1,
        removed: 1,
        revokedUrls: 1
    });
});

test('用户明确确认后可以再次下载相同结果', () => {
    const { browser, calls } = createBrowserHarness();
    const coordinator = audioExportDownload.createCoordinator({
        browser,
        dedupeWindowMs: 120000,
        now: () => 1000
    });
    const result = {
        blob: new Blob(['same-result'], { type: 'audio/wav' }),
        filename: 'unitale.wav',
        profile: 'balanced',
        outputFormat: 'wav'
    };

    assert.equal(coordinator.downloadOnce(result), true);
    assert.equal(coordinator.downloadOnce({ ...result, allowDuplicate: true }), true);
    assert.equal(calls.clicked, 2);
});

test('去重窗口结束后允许重新下载相同结果', () => {
    let currentTime = 1000;
    const { browser, calls } = createBrowserHarness();
    const coordinator = audioExportDownload.createCoordinator({
        browser,
        dedupeWindowMs: 100,
        now: () => currentTime
    });
    const result = {
        blob: new Blob(['same-result'], { type: 'audio/wav' }),
        filename: 'unitale.wav',
        profile: 'balanced',
        outputFormat: 'wav'
    };

    assert.equal(coordinator.downloadOnce(result), true);
    currentTime += 101;
    assert.equal(coordinator.downloadOnce(result), true);
    assert.equal(calls.clicked, 2);
});
