const normalizeTtsBaseUrl = (baseUrl: string): string => {
  return baseUrl.trim().replace(/\/+$/, '');
};

export class TtsClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async checkAudio(
    baseUrl: string,
    fileName: string,
    signal?: AbortSignal
  ): Promise<Response> {
    const endpoint = `${normalizeTtsBaseUrl(baseUrl)}/v1/check/audio?file_name=${encodeURIComponent(fileName)}`;
    return this.fetcher(endpoint, { signal });
  }

  async uploadAudio(
    baseUrl: string,
    formData: FormData,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.fetcher(`${normalizeTtsBaseUrl(baseUrl)}/v1/upload_audio`, {
      method: 'POST',
      body: formData,
      signal
    });
  }

  async synthesize(
    baseUrl: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.fetcher(`${normalizeTtsBaseUrl(baseUrl)}/v2/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    });
  }
}
