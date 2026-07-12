<script setup lang="ts">
import { computed } from 'vue';

import ConfigPanel from '../components/ConfigPanel.vue';
import ProjectTransferPanel from '../components/ProjectTransferPanel.vue';
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
    <section class="workspace-card" :data-active-tab="activeTab">
      <header class="studio-header">
        <div class="studio-brand">
          <div>
            <p class="eyebrow">TTS STUDIO</p>
            <div class="studio-title-row">
              <h1>TTS <span>1.5</span></h1>
              <span class="studio-revision">DESIGN R2</span>
            </div>
            <p>多角色音效合成有声书生成工具</p>
          </div>
          <div class="studio-brand-wave" aria-hidden="true"></div>
        </div>

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
      </header>

      <section class="workspace-context">
        <div>
          <p class="section-label">创作工作台 / {{ activePanel.caption }}</p>
          <h2>{{ activePanel.label }}</h2>
        </div>
        <p class="section-note">{{ activePanel.description }}</p>
        <span class="workspace-ready"><i></i> {{ migratedCount }}/{{ appStore.tabs.length }} 模块已接入</span>
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

      <template v-else>
        <ProjectTransferPanel compact />
        <ConfigPanel v-if="activeTab === 'config'" />
        <PromptPanel v-else-if="activeTab === 'prompt'" />
        <TimbresPanel v-else-if="activeTab === 'timbres'" />
        <SfxPanel v-else-if="activeTab === 'sfx'" />
        <ScriptPanel v-else />
      </template>
    </section>
  </main>
</template>
