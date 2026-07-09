import { TtsClient } from './ttsClient';

export const normalizeTtsServiceBaseUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return normalized.endsWith('/v1') ? normalized.slice(0, -3) : normalized;
};

export const ensureReferenceAudioUploaded = async (options: {
  baseUrl: string;
  file: Blob;
  fileName: string;
  promptText?: string;
  signal?: AbortSignal;
  ttsClient?: TtsClient;
}): Promise<void> => {
  const { baseUrl, file, fileName, promptText, signal } = options;
  const ttsClient = options.ttsClient ?? new TtsClient();
  const normalizedBaseUrl = normalizeTtsServiceBaseUrl(baseUrl);
  const normalizedPromptText = promptText?.trim() ?? '';

  let exists = false;
  let hasPromptText = false;

  try {
    const checkResponse = await ttsClient.checkAudio(normalizedBaseUrl, fileName, signal);

    if (checkResponse.ok) {
      const payload = (await checkResponse.json()) as {
        exists?: boolean;
        has_prompt_text?: boolean;
      };
      exists = payload.exists === true;
      hasPromptText = payload.has_prompt_text === true;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
  }

  if (exists && (!normalizedPromptText || hasPromptText)) {
    return;
  }

  const formData = new FormData();
  formData.append('audio', file, fileName);
  formData.append('full_path', fileName);
  if (normalizedPromptText) {
    formData.append('prompt_text', normalizedPromptText);
  }

  const uploadResponse = await ttsClient.uploadAudio(normalizedBaseUrl, formData, signal);

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`上传参考音频失败：${errorText || uploadResponse.status}`);
  }
};
