import { defineStore } from 'pinia';
import { ref } from 'vue';

import { PreferenceRepository } from '../services/storage/preferenceRepository';
import { STORAGE_KEYS } from './settings.defaults';

export interface AppTabItem {
  id: 'config' | 'timbres' | 'sfx' | 'script' | 'prompt';
  label: string;
  caption: string;
  description: string;
}

const preferenceRepository = new PreferenceRepository();

const tabs: AppTabItem[] = [
  {
    id: 'config',
    label: '模型配置',
    caption: 'LLM / TTS',
    description: '兼容旧键的 LLM / TTS 配置中心，供脚本分析、音色生成和台词合成复用。'
  },
  {
    id: 'timbres',
    label: '音色资源库',
    caption: '音色 / 情绪',
    description: '支持参考音频恢复、情绪预设维护，以及角色音色分析和生成后的回写。'
  },
  {
    id: 'sfx',
    label: '音效与滤波器',
    caption: 'SFX / BGM / Filter',
    description: '支持 SFX / BGM / Filter 资源维护，供批量生成、顺序播放和离线导出复用。'
  },
  {
    id: 'script',
    label: '脚本制作',
    caption: '多脚本 / 块编辑',
    description: '支持多脚本、三类块编辑、单行/批量生成、顺序播放以及 SRT / WAV / MP4 导出。'
  },
  {
    id: 'prompt',
    label: 'Prompt 管理',
    caption: '模板与默认值',
    description: '支持脚本分析 Prompt、音色分析 Prompt 和 Qwen 参考文本模板的本地兼容层。'
  }
];

export const useAppStore = defineStore('app', () => {
  const isHydrated = ref(false);
  const activeTab = ref<AppTabItem['id']>('script');

  const hydrate = () => {
    if (isHydrated.value) {
      return;
    }

    const savedTab = preferenceRepository.getString(STORAGE_KEYS.activeTab);
    const matchedTab = tabs.find((item) => item.id === savedTab);

    if (matchedTab) {
      activeTab.value = matchedTab.id;
    }

    isHydrated.value = true;
  };

  const setActiveTab = (tabId: AppTabItem['id']) => {
    activeTab.value = tabId;
    preferenceRepository.setString(STORAGE_KEYS.activeTab, tabId);
  };

  return {
    isHydrated,
    activeTab,
    tabs,
    hydrate,
    setActiveTab
  };
});
