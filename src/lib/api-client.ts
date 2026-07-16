import { CSRF_COOKIE_NAME } from "@/lib/security/auth-constants";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message ?? "Permintaan gagal.");
    this.name = "ApiClientError";
    this.status = status;
    this.code = payload.error?.code ?? "REQUEST_FAILED";
    this.fields = payload.error?.fields;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : undefined;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown | FormData;
  } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const isFormData = options.body instanceof FormData;
  const csrfToken = readCookie(CSRF_COOKIE_NAME);
  const headers = new Headers({ "X-VCard-Request": "1" });

  if (!isFormData && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  let requestBody: BodyInit | undefined;
  if (options.body instanceof FormData) {
    requestBody = options.body;
  } else if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    body: requestBody,
  });

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & { data?: T };
  if (!response.ok) {
    throw new ApiClientError(response.status, payload);
  }
  return payload.data as T;
}
