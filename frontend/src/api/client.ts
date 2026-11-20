/**
 * Centralized API client. All requests go through here — components never
 * call fetch directly. Auth token comes from localStorage; the backend is the
 * security boundary, this is only for UX.
 */

const TOKEN_KEY = "frc_portal_token";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;

  constructor(message: string, status: number, code: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.", 0, "network_error");
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: Record<string, string> } })?.error;
    throw new ApiError(
      err?.message || `Request failed (${res.status})`,
      res.status,
      err?.code || "unknown_error",
      err?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Multipart upload (files). Content-Type is set by the browser. */
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(`${BASE}/api${path}`, { method: "POST", headers, body: form });
    } catch {
      throw new ApiError("Could not reach the server. Check your connection.", 0, "network_error");
    }
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      const err = (payload as { error?: { code?: string; message?: string; details?: Record<string, string> } })?.error;
      throw new ApiError(err?.message || `Request failed (${res.status})`, res.status, err?.code || "unknown_error", err?.details);
    }
    return payload as T;
  },
  /** Authenticated raw fetch (used for file downloads). */
  fetch: async (path: string) => {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${BASE}/api${path}`, { headers });
  },
};
