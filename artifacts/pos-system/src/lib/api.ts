function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("pos_token") || localStorage.getItem("pos_token") || "";
}

export function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
}

export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetchAuth(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown network error");
    throw new Error(errorText || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function apiPost<T = any>(url: string, body: any): Promise<T> {
  const res = await fetchAuth(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown network error");
    throw new Error(errorText || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function apiPut<T = any>(url: string, body: any): Promise<T> {
  const res = await fetchAuth(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown network error");
    throw new Error(errorText || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function apiDelete(url: string): Promise<void> {
  const res = await fetchAuth(url, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const errorText = await res.text().catch(() => "Unknown network error");
    throw new Error(errorText || `Request failed with status ${res.status}`);
  }
}
