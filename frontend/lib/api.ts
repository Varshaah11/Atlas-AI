const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type FetchApiOptions = RequestInit & {
  timeoutMs?: number;
  throwOnHttpError?: boolean;
};

// Patterns that indicate sensitive internal implementation details or leaks
const SENSITIVE_PATTERNS = [
  /PrismaClient/i,
  /AxiosError/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ETIMEDOUT/i,
  /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i,
  /gsk_[a-zA-Z0-9_-]+/i, // Groq API keys
  /file:\/\/\//i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUIDs
  /at\s+[a-zA-Z0-9_.\/\\-]+\.js:\d+:\d+/i, // Stack trace frames
  /Internal\s+Server\s+Error/i,
];

function isUnsafeMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function getServiceErrorMessage(candidate: string): string | null {
  const lower = candidate.toLowerCase();
  if (lower.includes('finnhub') || lower.includes('quote service')) {
    return 'Market data is temporarily unavailable. Please try again shortly.';
  }
  if (lower.includes('sec edgar') || lower.includes('sec filing')) {
    return 'SEC filing data is temporarily unavailable. Please try again shortly.';
  }
  if (lower.includes('groq') || lower.includes('llama') || lower.includes('llm engine')) {
    return 'Atlas AI is temporarily unable to generate a response. Please try again shortly.';
  }
  if (lower.includes('telegram') || lower.includes('bot api')) {
    return 'Telegram delivery is currently unavailable. Your Atlas AI data is still available here.';
  }
  if (lower.includes('prisma') || lower.includes('postgres') || lower.includes('database')) {
    return 'Atlas AI is having trouble reaching its data store. Please try again shortly.';
  }
  return null;
}

export function extractApiErrorMessage(payload: unknown, status?: number): string {
  let candidate = '';

  if (typeof payload === 'string') {
    candidate = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      candidate = obj.message;
    } else if (Array.isArray(obj.message) && obj.message.length > 0) {
      candidate = obj.message.map((item) => String(item)).join('; ');
    } else if (typeof obj.error === 'string') {
      candidate = obj.error;
    }
  }

  if (candidate) {
    const friendlyServiceMsg = getServiceErrorMessage(candidate);
    if (friendlyServiceMsg) {
      return friendlyServiceMsg;
    }
    if (!isUnsafeMessage(candidate)) {
      return candidate;
    }
  }

  // Safe status-specific fallbacks
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with the current state.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      if (status && status >= 500) {
        return 'Atlas AI is temporarily unavailable. Please try again later.';
      }
      return 'An unexpected error occurred. Please try again.';
  }
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR';
  }
}

export async function fetchApi(
  path: string,
  options: FetchApiOptions = {},
): Promise<Response> {
  const {
    timeoutMs = options.body instanceof FormData ? 60000 : 15000,
    throwOnHttpError = true,
    ...fetchOptions
  } = options;

  const url = path.startsWith('/') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`;

  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('x-user-id')) {
    headers.set('x-user-id', 'default-web-user');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (fetchOptions.signal) {
    fetchOptions.signal.addEventListener('abort', () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(
        'That request is taking too long. Please try again.',
        408,
        'TIMEOUT',
      );
    }
    throw new ApiError(
      'Unable to reach Atlas AI. Please check your connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (throwOnHttpError && !response.ok) {
    let payload: unknown = null;
    try {
      const text = await response.text();
      if (text) {
        payload = JSON.parse(text);
      }
    } catch {
      payload = null;
    }

    const safeMessage = extractApiErrorMessage(payload, response.status);
    const code = getErrorCode(response.status);
    const apiError = new ApiError(safeMessage, response.status, code, payload);

    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('atlas:unauthorized', { detail: apiError }));
    }

    throw apiError;
  }

  return response;
}

export { API_BASE_URL };
