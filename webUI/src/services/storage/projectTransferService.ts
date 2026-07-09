import {
  cloneData,
  normalizeProjectEnvelope,
  stripRuntimeProjectEnvelope,
  type AudioLibraryItem,
  type BgImageLine,
  type DialogueLine,
  type ProjectEnvelope,
  type ScriptEntry,
  type TimbreLibraryItem
} from '../../domain/project';
import { AssetRepository, type AssetBatchItem } from './assetRepository';
import { ProjectRepository } from './projectRepository';

interface EmbeddedLibraryAsset {
  _fileData?: string;
  _mimeType?: string;
}

interface EmbeddedDialogueLine extends DialogueLine {
  audioBase64?: string;
}

interface EmbeddedBgImageLine extends BgImageLine {
  imageBase64?: string;
}

interface ExportEnvelope extends ProjectEnvelope {
  exportedAt?: string;
}

export interface ImportProjectResult {
  importedAssetCount: number;
  isLegacyImport: boolean;
  project: ProjectEnvelope;
}

const projectRepository = new ProjectRepository();
const assetRepository = new AssetRepository();

const decodeBase64Payload = (payload: string): Uint8Array => {
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const dataUrlToBlob = (value: string, fallbackMimeType: string): Blob => {
  const match = value.match(/^data:(.*?);base64,(.*)$/);

  if (!match) {
    throw new Error('不支持的内嵌资源格式');
  }

  const bytes = decodeBase64Payload(match[2]);
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);

  return new Blob([copiedBytes], {
    type: match[1] || fallbackMimeType
  });
};

const loadEmbeddedBlob = async (
  value: string,
  fallbackMimeType: string
): Promise<Blob> => {
  if (value.startsWith('data:')) {
    return dataUrlToBlob(value, fallbackMimeType);
  }

  const response = await fetch(value);

  if (!response.ok) {
    throw new Error(`资源拉取失败：HTTP ${response.status}`);
  }

  return response.blob();
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取 Blob 失败'));
    reader.readAsDataURL(blob);
  });
};

const extractEmbeddedBase64Payloads = (text: string): {
  extractedPayloads: string[];
  jsonText: string;
} => {
  const extractedPayloads: string[] = [];
  const jsonText = text.replace(
    /"(_fileData|audioBase64|imageBase64)":"(data:[^"]+)"/g,
    (_match, key: string, payload: string) => {
      extractedPayloads.push(payload);
      return `"${key}":"__EXTRACTED_BASE64_${extractedPayloads.length - 1}__"`;
    }
  );

  return { extractedPayloads, jsonText };
};

const resolveEmbeddedPayload = (value: unknown, extractedPayloads: string[]): string => {
  if (typeof value !== 'string') {
    return '';
  }

  if (!value.startsWith('__EXTRACTED_BASE64_')) {
    return value;
  }

  const match = value.match(/__EXTRACTED_BASE64_(\d+)__/);
  return match ? extractedPayloads[Number(match[1])] ?? '' : '';
};

const pushLibraryAsset = async (
  item: AudioLibraryItem | TimbreLibraryItem,
  fileData: string | undefined,
  mimeType: string | undefined,
  fallbackMimeType: string,
  assetsToSave: AssetBatchItem[]
) => {
  if (!fileData || !item.assetKey) {
    return;
  }

  const blob = await loadEmbeddedBlob(fileData, mimeType || fallbackMimeType);
  assetsToSave.push({ key: item.assetKey, blob });
};

const pushDialogueAsset = async (
  line: EmbeddedDialogueLine,
  fileData: string | undefined,
  assetsToSave: AssetBatchItem[]
) => {
  if (!fileData) {
    return;
  }

  const assetKey = line.audioAssetKey || `line_audio_${line.id}`;
  const blob = await loadEmbeddedBlob(fileData, 'audio/wav');
  assetsToSave.push({ key: assetKey, blob });
};

const pushBgImageAsset = async (
  line: EmbeddedBgImageLine,
  fileData: string | undefined,
  assetsToSave: AssetBatchItem[]
) => {
  if (!fileData) {
    return;
  }

  line.bgImageAssetKey = line.bgImageAssetKey || `bgImage_${line.id}`;
  const blob = await loadEmbeddedBlob(fileData, line.imageMimeType || 'image/png');
  assetsToSave.push({ key: line.bgImageAssetKey, blob });
};

const stripEmbeddedFields = (project: ProjectEnvelope) => {
  project.libraries.sfx.forEach((item) => {
    delete (item as EmbeddedLibraryAsset)._fileData;
    delete (item as EmbeddedLibraryAsset)._mimeType;
  });

  project.libraries.bgm.forEach((item) => {
    delete (item as EmbeddedLibraryAsset)._fileData;
    delete (item as EmbeddedLibraryAsset)._mimeType;
  });

  project.libraries.timbres.forEach((item) => {
    delete (item as EmbeddedLibraryAsset)._fileData;
    delete (item as EmbeddedLibraryAsset)._mimeType;
  });

  project.project.scriptList.forEach((script) => {
    script.data.scriptLines.forEach((line) => {
      if (line.type === 'dialogue') {
        delete (line as EmbeddedDialogueLine).audioBase64;
      }

      if (line.type === 'bgImage') {
        delete (line as EmbeddedBgImageLine).imageBase64;
      }
    });
  });
};

export class ProjectTransferService {
  async exportProjectBundle(rawProject: unknown): Promise<Blob> {
    const exportEnvelope = cloneData(
      stripRuntimeProjectEnvelope(rawProject)
    ) as ExportEnvelope;
    exportEnvelope.exportedAt = new Date().toISOString();

    const processLibrary = async (
      items: Array<AudioLibraryItem | TimbreLibraryItem>,
      applyEmbeddedFile: (item: AudioLibraryItem | TimbreLibraryItem, dataUrl: string, mimeType: string) => void
    ) => {
      for (const item of items) {
        if (!item.assetKey) {
          continue;
        }

        const blob = await assetRepository.loadAsset(item.assetKey);

        if (!blob) {
          continue;
        }

        const dataUrl = await blobToDataUrl(blob);
        applyEmbeddedFile(item, dataUrl, blob.type);
      }
    };

    await processLibrary(exportEnvelope.libraries.sfx, (item, dataUrl, mimeType) => {
      (item as EmbeddedLibraryAsset)._fileData = dataUrl;
      (item as EmbeddedLibraryAsset)._mimeType = mimeType;
    });
    await processLibrary(exportEnvelope.libraries.bgm, (item, dataUrl, mimeType) => {
      (item as EmbeddedLibraryAsset)._fileData = dataUrl;
      (item as EmbeddedLibraryAsset)._mimeType = mimeType;
    });
    await processLibrary(exportEnvelope.libraries.timbres, (item, dataUrl, mimeType) => {
      (item as EmbeddedLibraryAsset)._fileData = dataUrl;
      (item as EmbeddedLibraryAsset)._mimeType = mimeType;
    });

    for (const script of exportEnvelope.project.scriptList) {
      for (const line of script.data.scriptLines) {
        if (line.type === 'dialogue' && line.audioAssetKey) {
          const blob = await assetRepository.loadAsset(line.audioAssetKey);

          if (blob) {
            (line as EmbeddedDialogueLine).audioBase64 = await blobToDataUrl(blob);
          }
        }

        if (line.type === 'bgImage' && line.bgImageAssetKey) {
          const blob = await assetRepository.loadAsset(line.bgImageAssetKey);

          if (blob) {
            (line as EmbeddedBgImageLine).imageBase64 = await blobToDataUrl(blob);
            line.imageMimeType = blob.type || line.imageMimeType;
          }
        }
      }
    }

    return new Blob([JSON.stringify(exportEnvelope)], { type: 'application/json' });
  }

  async importProjectText(text: string): Promise<ImportProjectResult> {
    const { extractedPayloads, jsonText } = extractEmbeddedBase64Payloads(text);
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const isLegacyImport =
      parsed.kind !== 'unitale-project' || parsed.schemaVersion !== 3;
    const normalizedProject = normalizeProjectEnvelope(parsed);
    const assetsToSave: AssetBatchItem[] = [];

    for (const item of normalizedProject.libraries.sfx) {
      await pushLibraryAsset(
        item,
        resolveEmbeddedPayload((item as EmbeddedLibraryAsset)._fileData, extractedPayloads),
        (item as EmbeddedLibraryAsset)._mimeType,
        'audio/wav',
        assetsToSave
      );
    }

    for (const item of normalizedProject.libraries.bgm) {
      await pushLibraryAsset(
        item,
        resolveEmbeddedPayload((item as EmbeddedLibraryAsset)._fileData, extractedPayloads),
        (item as EmbeddedLibraryAsset)._mimeType,
        'audio/wav',
        assetsToSave
      );
    }

    for (const item of normalizedProject.libraries.timbres) {
      await pushLibraryAsset(
        item,
        resolveEmbeddedPayload((item as EmbeddedLibraryAsset)._fileData, extractedPayloads),
        (item as EmbeddedLibraryAsset)._mimeType,
        'audio/wav',
        assetsToSave
      );
    }

    for (const script of normalizedProject.project.scriptList as ScriptEntry[]) {
      for (const line of script.data.scriptLines) {
        if (line.type === 'dialogue') {
          await pushDialogueAsset(
            line as EmbeddedDialogueLine,
            resolveEmbeddedPayload((line as EmbeddedDialogueLine).audioBase64, extractedPayloads),
            assetsToSave
          );
        }

        if (line.type === 'bgImage') {
          await pushBgImageAsset(
            line as EmbeddedBgImageLine,
            resolveEmbeddedPayload((line as EmbeddedBgImageLine).imageBase64, extractedPayloads),
            assetsToSave
          );
        }
      }
    }

    stripEmbeddedFields(normalizedProject);
    const sanitizedProject = stripRuntimeProjectEnvelope(normalizedProject);

    if (assetsToSave.length > 0) {
      await assetRepository.saveAssetsBatch(assetsToSave);
    }

    await projectRepository.saveCurrentState(sanitizedProject);

    return {
      importedAssetCount: assetsToSave.length,
      isLegacyImport,
      project: sanitizedProject
    };
  }
}
