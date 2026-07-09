<script setup lang="ts">
import { computed } from 'vue';

import ConfigPanel from '../components/ConfigPanel.vue';
import PromptPanel from '../components/PromptPanel.vue';
import ScriptPanel from '../components/ScriptPanel.vue';
import SfxPanel from '../components/SfxPanel.vue';
import TimbresPanel from '../components/TimbresPanel.vue';
import { useAppStore } from '../stores/app.store';
import { useLibraryStore } from '../stores/library.store';
import { useProjectStore } from '../stores/project.store';
import { useSettingsStore } from '../stores/settings.store';

const appStore = useAppStore();
const libraryStore = useLibraryStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const activeTab = computed(() => appStore.activeTab);
const activePanel = computed(() =>
  appStore.tabs.find((tab) => tab.id === appStore.activeTab) ?? appStore.tabs[0],
);
const migratedCount = 5;
</script>

<template>
  <main class="shell">
    <section class="hero-card">
      <div class="hero-copy">
        <p class="eyebrow">P2 核心工作流</p>
        <h1>Unitale WebUI</h1>
        <p class="hero-text">
          新工程已经接入五个主标签页，并完成脚本分析、角色音色分析、单行/批量生成、顺序播放以及
          <code>SRT / WAV / MP4</code>
          导出。旧版
          <code>index.html</code>
          继续保留为行为回归对照物。
        </p>
      </div>
      <div class="hero-status">
        <span class="status-dot"></span>
        <span>已完成 {{ migratedCount }}/{{ appStore.tabs.length }} 个主标签页迁移</span>
      </div>
    </section>

    <section class="workspace-card">
      <header class="workspace-header">
        <div>
          <p class="section-label">应用壳层</p>
          <h2>完整工作流入口</h2>
        </div>
        <p class="section-note">保持旧信息架构和协议兼容，不额外改视觉和 schema。</p>
      </header>

      <nav class="tab-nav" aria-label="主标签页">
        <button
          v-for="tab in appStore.tabs"
          :key="tab.id"
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === tab.id }"
          @click="appStore.setActiveTab(tab.id)"
        >
          <span class="tab-name">{{ tab.label }}</span>
          <span class="tab-caption">{{ tab.caption }}</span>
        </button>
      </nav>

      <section class="summary-strip">
        <article class="panel-card">
          <p class="panel-kicker">当前页签</p>
          <h3>{{ activePanel.label }}</h3>
          <p class="panel-body">{{ activePanel.description }}</p>
        </article>

        <article class="panel-card panel-card--secondary">
          <p class="panel-kicker">迁移基线</p>
          <ul class="check-list">
            <li>新工程骨架已可 `dev/build/typecheck`</li>
            <li>`project-storage.js` 的稳定纯逻辑已迁入 `domain/project`</li>
            <li>配置、资源库、脚本工作台已接入新 store 与旧存储兼容层</li>
          </ul>
        </article>

        <article class="panel-card panel-card--secondary">
          <p class="panel-kicker">P2 已接入</p>
          <ul class="check-list">
            <li>LLM 分析、角色音色分析与音色生成流程</li>
            <li>单行试听、顺序播放、批量生成和背景图预扫描</li>
            <li>`SRT / WAV / MP4` 导出与完整工程恢复链路</li>
          </ul>
        </article>
      </section>

      <section
        v-if="
          !appStore.isHydrated ||
          !settingsStore.isHydrated ||
          !libraryStore.isHydrated ||
          !projectStore.isHydrated
        "
        class="loading-card"
      >
        正在恢复本地配置...
      </section>

      <ConfigPanel v-else-if="activeTab === 'config'" />
      <PromptPanel v-else-if="activeTab === 'prompt'" />
      <TimbresPanel v-else-if="activeTab === 'timbres'" />
      <SfxPanel v-else-if="activeTab === 'sfx'" />
      <ScriptPanel v-else />
    </section>
  </main>
</template>
