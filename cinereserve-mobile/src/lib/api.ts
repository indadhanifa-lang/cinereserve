// VITE_API_BASE wins when set (required for native Capacitor builds). Otherwise
// target port 8000 on whichever host served the app, so a phone opening
// http://<pc-lan-ip>:5173 talks to http://<pc-lan-ip>:8000 instead of itself.
const API_BASE: string =
  import.meta.env.VITE_API_BASE ??
  `${window.location.protocol}//${window.location.hostname}:8000/api`;

const API_ORIGIN = API_BASE.replace(/\/api$/, "");

const TOKEN_KEY = "cinereserve_token";

let sessionToken: string | null = null;

interface ApiError {
  status: number;
  message?: string;
  errors?: Record<string, string[]>;
  unavailable_seat_ids?: number[];
}

export function getToken(): string | null {
  if (sessionToken) return sessionToken;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean): void {
  sessionToken = token;
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken(): void {
  sessionToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: data.message };
    if (data.errors) error.errors = data.errors;
    throw error;
  }

  return data as T;
}

export async function apiPostAuth<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: data.message };
    if (data.errors) error.errors = data.errors;
    if (Array.isArray(data.unavailable_seat_ids)) error.unavailable_seat_ids = data.unavailable_seat_ids;
    throw error;
  }

  return data as T;
}

export async function apiGetAuth<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: data.message };
    if (data.errors) error.errors = data.errors;
    throw error;
  }

  return data as T;
}

export async function apiPatchAuth<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: data.message };
    if (data.errors) error.errors = data.errors;
    throw error;
  }

  return data as T;
}

/**
 * Turn a stored avatar path ("/storage/avatars/x.png") into an absolute URL
 * on the API origin. Absolute URLs pass through unchanged; null stays null.
 */
export function resolveStorageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Multipart upload. Never set Content-Type here: fetch must generate the
 * multipart boundary itself, otherwise the request fails server-side.
 */
export async function apiUploadAuth<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: data.message };
    if (data.errors) error.errors = data.errors;
    throw error;
  }

  return data as T;
}

export async function apiPostAuthLogout(): Promise<void> {
  const token = getToken();
  await fetch(`${API_BASE}/customer/logout`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
