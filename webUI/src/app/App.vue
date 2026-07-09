<script setup lang="ts">
import { onMounted } from 'vue';

import AppShell from './AppShell.vue';
import { useAppStore } from '../stores/app.store';
import { useLibraryStore } from '../stores/library.store';
import { useProjectStore } from '../stores/project.store';
import { useSettingsStore } from '../stores/settings.store';

const appStore = useAppStore();
const libraryStore = useLibraryStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

onMounted(() => {
  appStore.hydrate();
  settingsStore.hydrate();
  void libraryStore.hydrate();
  void projectStore.hydrate();
});
</script>

<template>
  <AppShell />
</template>
