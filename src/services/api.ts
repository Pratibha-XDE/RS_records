/**
 * Centralized API client for communicating with the Django REST Framework backend.
 */

const isProd =
  typeof import.meta !== "undefined" && import.meta.env && Boolean(import.meta.env.PROD);

// In production, fallback to relative URL ("") so deployments do not depend on localhost.
// In development, default to local Django server (http://127.0.0.1:8000).
const DEFAULT_API_BASE_URL = isProd ? "" : "http://127.0.0.1:8000";

const rawEnvUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env["VITE_API_BASE_URL"] as string | undefined)
    : undefined;

export const API_BASE_URL = (rawEnvUrl !== undefined ? rawEnvUrl : DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  "",
);

export const AUTH_TOKEN_KEY = "dwc_auth_token";
export const AUTH_USER_KEY = "dwc_auth_user";

export class ApiError extends Error {
  status: number;
  data: unknown;
  fieldErrors: Record<string, string[]> | undefined;

  constructor(
    message: string,
    status: number,
    data?: unknown,
    fieldErrors?: Record<string, string[]> | undefined,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Parses DRF validation and error response payloads into a readable message and field errors.
 */
export function parseDrfError(
  data: unknown,
  fallback = "An unexpected error occurred.",
): { message: string; fieldErrors?: Record<string, string[]> } {
  if (!data || typeof data !== "object") {
    return { message: typeof data === "string" && data.trim() ? data : fallback };
  }

  // Handle single detail message: { "detail": "Invalid credentials provided." }
  if ("detail" in data && typeof (data as { detail: unknown }).detail === "string") {
    return { message: (data as { detail: string }).detail };
  }

  const fieldErrors: Record<string, string[]> = {};
  const errorLines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      const messages = value.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
      fieldErrors[key] = messages;
      if (key === "non_field_errors" || key === "detail") {
        errorLines.push(...messages);
      } else {
        errorLines.push(`${key}: ${messages.join(" ")}`);
      }
    } else if (typeof value === "string") {
      fieldErrors[key] = [value];
      if (key === "non_field_errors" || key === "detail") {
        errorLines.push(value);
      } else {
        errorLines.push(`${key}: ${value}`);
      }
    }
  }

  if (errorLines.length > 0) {
    return { message: errorLines.join("; "), fieldErrors };
  }

  return { message: fallback };
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  // Also remove legacy mock storage key if present
  localStorage.removeItem("dwc_session");
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const urlPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let fullUrl = `${API_BASE_URL}${urlPath}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes("?") ? "&" : "?") + queryString;
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      // DRF TokenAuthentication header: Token <key>
      headers["Authorization"] = `Token ${token}`;
    }
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (
      typeof body === "string" ||
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof URLSearchParams
    ) {
      requestBody = body as BodyInit;
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const fetchInit: RequestInit = {
    ...fetchOptions,
    headers,
  };
  if (requestBody !== undefined) {
    fetchInit.body = requestBody;
  }

  const response = await fetch(fullUrl, fetchInit);

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const responseData = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      // Authentication credentials invalid or revoked; clear local token
      clearAuthToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("dwc:unauthorized"));
      }
    }

    const { message, fieldErrors } = parseDrfError(
      responseData,
      `Request failed with status ${response.status}`,
    );
    throw new ApiError(message, response.status, responseData, fieldErrors);
  }

  return responseData as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
