import type {
  AudioLibraryItem,
  EmotionPreset,
  FilterLibraryItem,
  TimbreLibraryItem
} from '../domain/project';

export const SYSTEM_EMOTIONS: EmotionPreset[] = [
  { id: 'sys_1', name: '高兴', vector: [1, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'sys_2', name: '生气', vector: [0, 1, 0, 0, 0, 0, 0, 0] },
  { id: 'sys_3', name: '伤心', vector: [0, 0, 1, 0, 0, 0, 0, 0] },
  { id: 'sys_4', name: '害怕', vector: [0, 0, 0, 1, 0, 0, 0, 0] },
  { id: 'sys_5', name: '厌恶', vector: [0, 0, 0, 0, 1, 0, 0, 0] },
  { id: 'sys_6', name: '低落', vector: [0, 0, 0, 0, 0, 1, 0, 0] },
  { id: 'sys_7', name: '惊喜', vector: [0, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'sys_8', name: '平静', vector: [0, 0, 0, 0, 0, 0, 0, 1] }
];

export const DEFAULT_FILTERS: FilterLibraryItem[] = [
  {
    id: 'f1',
    name: '电话音',
    description: '模拟电话通话时的窄频带声音',
    type: 'bandpass',
    frequency: 1700,
    Q: 1.5,
    gain: 0,
    enabled: true
  },
  {
    id: 'f2',
    name: '水下',
    description: '模拟在水下听到的闷声',
    type: 'lowpass',
    frequency: 400,
    Q: 1,
    gain: 0,
    enabled: true
  },
  {
    id: 'f3',
    name: '老广播',
    description: '模拟老式收音机或广播的尖锐声音',
    type: 'highpass',
    frequency: 1500,
    Q: 1,
    gain: 0,
    enabled: true
  },
  {
    id: 'f4',
    name: '机械失真',
    description: '模拟机器人或设备损坏时的失真声音',
    type: 'distortion',
    frequency: 1000,
    Q: 1,
    gain: 50,
    enabled: true
  }
];

export const createEmptyTimbre = (): TimbreLibraryItem => ({
  id: '',
  name: '',
  description: '',
  promptText: '',
  refPath: '',
  assetKey: ''
});

export const createEmptyAudioLibraryItem = (): AudioLibraryItem => ({
  id: '',
  name: '',
  description: '',
  filename: '',
  assetKey: '',
  trimStart: 0,
  trimEnd: 1,
  volume: 0.3,
  enabled: true
});

export const createEmptyFilter = (): FilterLibraryItem => ({
  id: '',
  name: '',
  description: '',
  type: 'lowpass',
  frequency: 1000,
  Q: 1,
  gain: 0,
  enabled: true
});

export const createEmptyEmotionPreset = (): EmotionPreset => ({
  id: '',
  name: '',
  vector: [0, 0, 0, 0, 0, 0, 0, 0],
  enabled: true
});

export const isSystemEmotion = (name: string): boolean => {
  return SYSTEM_EMOTIONS.some((item) => item.name === name);
};
