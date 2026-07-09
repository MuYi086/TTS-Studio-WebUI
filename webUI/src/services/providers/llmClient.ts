export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionsRequest {
  model: string;
  messages: ChatMessage[];
  apiKey?: string;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

const normalizeOpenAiBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
};

export class LlmClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async chatCompletions(baseUrl: string, payload: ChatCompletionsRequest): Promise<Response> {
    const { apiKey, signal, ...body } = payload;

    return this.fetcher(normalizeOpenAiBaseUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal
    });
  }
}
