<script setup lang="ts">
import { ref } from 'vue';

import { ProjectTransferService } from '../services/storage/projectTransferService';
import { useJobsStore } from '../stores/jobs.store';
import { useLibraryStore } from '../stores/library.store';
import { usePlaybackStore } from '../stores/playback.store';
import { useProjectStore } from '../stores/project.store';

const jobsStore = useJobsStore();
const libraryStore = useLibraryStore();
const playbackStore = usePlaybackStore();
const projectStore = useProjectStore();
const projectTransferService = new ProjectTransferService();

const isImporting = ref(false);
const isExporting = ref(false);
const notice = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

const buildCurrentEnvelope = () => ({
  savedAt: Date.now(),
  libraries: {
    sfx: libraryStore.sfxLibrary,
    bgm: libraryStore.bgmLibrary,
    timbres: libraryStore.timbres,
    filters: libraryStore.filterLibrary,
    emotions: libraryStore.emotionPresets
  },
  project: projectStore.projectState
});

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const buildExportFileName = () => {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('') + '_' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');

  return `Unitale工程文件_${timestamp}.json`;
};

const exportProject = async () => {
  isExporting.value = true;
  notice.value = '';

  try {
    const blob = await projectTransferService.exportProjectBundle(buildCurrentEnvelope());
    downloadBlob(blob, buildExportFileName());
    notice.value = '完整工程已导出。';
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    notice.value = `导出失败：${message}`;
  } finally {
    isExporting.value = false;
  }
};

const triggerImport = () => {
  fileInputRef.value?.click();
};

const importProject = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  if (
    !window.confirm('导入将覆盖当前的资源库和脚本状态，模型配置不会被覆盖。确定继续吗？')
  ) {
    input.value = '';
    return;
  }

  isImporting.value = true;
  notice.value = '';

  try {
    const text = await file.text();
    const result = await projectTransferService.importProjectText(text);

    libraryStore.replaceLibraries(result.project.libraries);
    projectStore.replaceProjectState(result.project.project);
    playbackStore.clearSelection();
    playbackStore.resetRuntime();
    jobsStore.resetAll();

    notice.value = result.isLegacyImport
      ? `旧版工程已迁移导入，恢复 ${result.importedAssetCount} 个资产。`
      : `完整工程导入成功，恢复 ${result.importedAssetCount} 个资产。`;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    notice.value = `导入失败：${message}`;
  } finally {
    isImporting.value = false;
    input.value = '';
  }
};
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">工程传输</p>
        <h3 class="title">导入与导出完整工程</h3>
      </div>
      <p class="note">完整工程 JSON 与旧版 `kind/schemaVersion/assets` 保持兼容，可用于回归恢复。</p>
    </header>

    <div class="actions">
      <button type="button" class="primary" :disabled="isExporting || isImporting" @click="exportProject">
        {{ isExporting ? '导出中...' : '导出完整工程' }}
      </button>
      <button type="button" class="secondary" :disabled="isExporting || isImporting" @click="triggerImport">
        {{ isImporting ? '导入中...' : '导入完整工程' }}
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="application/json,.json"
        class="hidden-input"
        @change="importProject"
      />
      <span v-if="notice" class="notice">{{ notice }}</span>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(79, 70, 229, 0.06), transparent 48%),
    rgba(255, 255, 255, 0.94);
}

.header,
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header {
  justify-content: space-between;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #4f46e5;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title,
.note {
  margin: 0;
}

.note,
.notice {
  color: #64748b;
}

.primary,
.secondary {
  border: none;
  border-radius: 999px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 700;
}

.primary {
  background: #4f46e5;
  color: #fff;
}

.secondary {
  background: rgba(148, 163, 184, 0.16);
  color: #334155;
}

.primary:disabled,
.secondary:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.hidden-input {
  display: none;
}

.notice {
  font-size: 0.92rem;
}

@media (max-width: 780px) {
  .header,
  .actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
