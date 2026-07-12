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
      <div class="hero-copy brand-lockup">
        <p class="eyebrow">TTS STUDIO / MULTI-TRACK AUDIOBOOK</p>
        <h1>TTS <span>1.5</span></h1>
        <p class="hero-text">多角色音效合成有声书生成工具</p>
      </div>
      <div class="hero-status">
        <span class="status-dot"></span>
        <span>本地工作台已就绪 · {{ migratedCount }}/{{ appStore.tabs.length }} 个核心模块</span>
      </div>
    </section>

    <section class="workspace-card">
      <header class="workspace-header">
        <div>
          <p class="section-label">创作工作台</p>
          <h2>{{ activePanel.label }}</h2>
        </div>
        <p class="section-note">{{ activePanel.description }}</p>
      </header>

      <nav class="tab-nav" aria-label="主标签页">
        <button
          v-for="(tab, index) in appStore.tabs"
          :key="tab.id"
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === tab.id }"
          @click="appStore.setActiveTab(tab.id)"
        >
          <span class="tab-index">0{{ index + 1 }}</span>
          <span class="tab-name">{{ tab.label }}</span>
          <span class="tab-caption">{{ tab.caption }}</span>
        </button>
      </nav>

      <section class="summary-strip">
        <article class="panel-card">
          <p class="panel-kicker">当前模块</p>
          <h3>{{ activePanel.label }}</h3>
          <p class="panel-body">{{ activePanel.description }}</p>
        </article>

        <article class="panel-card panel-card--secondary">
          <p class="panel-kicker">工作流能力</p>
          <ul class="check-list">
            <li>模型连接、音色资源、音效滤波与脚本制作</li>
            <li>AI 角色分析、单句试听、批量合成和顺序播放</li>
            <li>完整工程、SRT 字幕、音频与视频导出</li>
          </ul>
        </article>

        <article class="panel-card panel-card--secondary">
          <p class="panel-kicker">设计基准</p>
          <ul class="check-list">
            <li>蓝紫深色工作台与波形光效</li>
            <li>1920 × 1080 桌面端主视图优先</li>
            <li>保留既有存储键、协议与业务行为</li>
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
