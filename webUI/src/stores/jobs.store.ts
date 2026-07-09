import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export type JobKind = 'analysis' | 'voiceDesign' | 'tts' | 'export';
export type JobStatus = 'idle' | 'running' | 'success' | 'error';

export interface JobState {
  id: JobKind;
  label: string;
  message: string;
  status: JobStatus;
  updatedAt: number | null;
}

const createDefaultJobs = (): Record<JobKind, JobState> => ({
  analysis: {
    id: 'analysis',
    label: '剧本分析',
    message: '等待触发脚本分析。',
    status: 'idle',
    updatedAt: null
  },
  voiceDesign: {
    id: 'voiceDesign',
    label: '角色音色分析',
    message: '等待触发角色音色分析或音色生成。',
    status: 'idle',
    updatedAt: null
  },
  tts: {
    id: 'tts',
    label: '台词生成',
    message: '等待触发单行或批量台词生成。',
    status: 'idle',
    updatedAt: null
  },
  export: {
    id: 'export',
    label: '导出链路',
    message: '等待触发 SRT / WAV / MP4 导出。',
    status: 'idle',
    updatedAt: null
  }
});

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<Record<JobKind, JobState>>(createDefaultJobs());

  const jobList = computed(() => Object.values(jobs.value));
  const isBusy = computed(() => jobList.value.some((job) => job.status === 'running'));

  const updateJob = (kind: JobKind, status: JobStatus, message: string) => {
    jobs.value[kind] = {
      ...jobs.value[kind],
      status,
      message,
      updatedAt: Date.now()
    };
  };

  const resetJob = (kind: JobKind) => {
    jobs.value[kind] = createDefaultJobs()[kind];
  };

  const resetAll = () => {
    jobs.value = createDefaultJobs();
  };

  return {
    jobs,
    jobList,
    isBusy,
    updateJob,
    resetJob,
    resetAll
  };
});
