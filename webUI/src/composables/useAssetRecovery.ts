import {
  computed,
  reactive,
  readonly,
  toValue,
  watch,
  type MaybeRefOrGetter
} from 'vue';

import { AssetRepository } from '../services/storage/assetRepository';

export type AssetRecoveryStatus = 'present' | 'missing';

const assetRepository = new AssetRepository();
const assetStatusState = reactive<Record<string, AssetRecoveryStatus>>({});
const assetUrlState = reactive<Record<string, string>>({});
const pendingStatusTasks = new Map<string, Promise<void>>();
const pendingImageTasks = new Map<string, Promise<void>>();
const objectUrlCache = new Map<string, string>();

const normalizeKeys = (value: string[]): string[] => {
  return Array.from(
    new Set(
      value
        .map((item) => item.trim())
        .filter((item) => Boolean(item))
    )
  );
};

const readAssetStatus = async (key: string): Promise<void> => {
  if (pendingStatusTasks.has(key)) {
    await pendingStatusTasks.get(key);
    return;
  }

  const task = (async () => {
    const asset = await assetRepository.loadAsset(key);
    assetStatusState[key] = asset ? 'present' : 'missing';
  })().finally(() => {
    pendingStatusTasks.delete(key);
  });

  pendingStatusTasks.set(key, task);
  await task;
};

const readImageAsset = async (key: string): Promise<void> => {
  if (pendingImageTasks.has(key)) {
    await pendingImageTasks.get(key);
    return;
  }

  const task = (async () => {
    const asset = await assetRepository.loadAsset(key);
    assetStatusState[key] = asset ? 'present' : 'missing';

    if (!asset) {
      return;
    }

    const previousUrl = objectUrlCache.get(key);

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    const objectUrl = URL.createObjectURL(asset);
    objectUrlCache.set(key, objectUrl);
    assetUrlState[key] = objectUrl;
  })().finally(() => {
    pendingImageTasks.delete(key);
  });

  pendingImageTasks.set(key, task);
  await task;
};

export const useAssetRecovery = (options: {
  imageKeys?: MaybeRefOrGetter<string[]>;
  statusKeys?: MaybeRefOrGetter<string[]>;
} = {}) => {
  const statusKeys = computed(() => normalizeKeys(toValue(options.statusKeys ?? [])));
  const imageKeys = computed(() => normalizeKeys(toValue(options.imageKeys ?? [])));

  watch(
    statusKeys,
    (keys) => {
      keys.forEach((key) => {
        void readAssetStatus(key);
      });
    },
    { immediate: true }
  );

  watch(
    imageKeys,
    (keys) => {
      keys.forEach((key) => {
        void readImageAsset(key);
      });
    },
    { immediate: true }
  );

  return {
    assetStatusByKey: readonly(assetStatusState),
    assetUrlByKey: readonly(assetUrlState),
    refreshAssetStatus: readAssetStatus,
    refreshImageAsset: readImageAsset
  };
};
