export class VoiceDesignClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async designVoice(
    endpoint: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.fetcher(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    });
  }
}
