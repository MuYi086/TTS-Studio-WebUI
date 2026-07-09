<script setup lang="ts">
import type { JobState } from '../../stores/jobs.store';
import type { PlaybackMode } from '../../stores/playback.store';

defineProps<{
  currentLineCount: number;
  currentScriptName: string;
  isSavingProject: boolean;
  jobList: JobState[];
  playbackMode: PlaybackMode;
  previewAssetKey: string;
  selectedLineId: string;
}>();
</script>

<template>
  <article class="card">
    <header class="header">
      <div>
        <p class="eyebrow">运行态骨架</p>
        <h3 class="title">P1 状态面板</h3>
      </div>
      <span class="status-badge">
        {{ isSavingProject ? '草稿保存中' : '本地草稿已同步' }}
      </span>
    </header>

    <div class="summary-grid">
      <article class="summary-card">
        <p class="summary-label">当前脚本</p>
        <h4 class="summary-value">{{ currentScriptName }}</h4>
        <p class="summary-note">共 {{ currentLineCount }} 个脚本块</p>
      </article>

      <article class="summary-card">
        <p class="summary-label">行选中状态</p>
        <h4 class="summary-value">{{ selectedLineId ? '已选中' : '未选中' }}</h4>
        <p class="summary-note">{{ selectedLineId || '当前没有选中脚本块' }}</p>
      </article>

      <article class="summary-card">
        <p class="summary-label">播放状态</p>
        <h4 class="summary-value">{{ playbackMode }}</h4>
        <p class="summary-note">{{ previewAssetKey || 'P1 未接入试听运行时' }}</p>
      </article>
    </div>

    <div class="job-list">
      <article v-for="job in jobList" :key="job.id" class="job-card">
        <div class="job-top">
          <h4 class="job-title">{{ job.label }}</h4>
          <span class="job-status" :class="`job-status--${job.status}`">{{ job.status }}</span>
        </div>
        <p class="job-message">{{ job.message }}</p>
      </article>
    </div>
  </article>
</template>

<style scoped>
.card {
  padding: 22px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
}

.header,
.job-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header {
  margin-bottom: 18px;
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
.summary-value,
.job-title {
  margin: 0;
}

.status-badge,
.job-status {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 700;
}

.summary-grid,
.job-list {
  display: grid;
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 16px;
}

.summary-card,
.job-card {
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: #f8fafc;
}

.summary-label,
.job-message,
.summary-note {
  margin: 0;
  color: #64748b;
}

.summary-value {
  margin-top: 8px;
  margin-bottom: 6px;
  color: #0f172a;
}

.job-message {
  margin-top: 10px;
}

.job-status--idle {
  background: rgba(148, 163, 184, 0.18);
}

.job-status--running {
  background: rgba(59, 130, 246, 0.14);
  color: #1d4ed8;
}

.job-status--success {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.job-status--error {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}

@media (max-width: 980px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
