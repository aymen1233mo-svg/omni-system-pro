export function fetchAuth(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("pos_token") ?? "";
  return fetch(url, { ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });
}

export async function apiGet(url: string) {
  const r = await fetchAuth(url);
  if (!r.ok) {
    let msg = `HTTP Error ${r.status}`;
    try {
      const data = await r.json();
      msg = data.error || data.message || msg;
    } catch {
      const txt = await r.text().catch(() => "");
      if (txt && !txt.includes("<html")) msg = txt;
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function apiPost(url: string, body: any) {
  const r = await fetchAuth(url, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = `HTTP Error ${r.status}`;
    try {
      const data = await r.json();
      msg = data.error || data.message || msg;
    } catch {
      const txt = await r.text().catch(() => "");
      if (txt && !txt.includes("<html")) msg = txt;
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function apiPut(url: string, body: any) {
  const r = await fetchAuth(url, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = `HTTP Error ${r.status}`;
    try {
      const data = await r.json();
      msg = data.error || data.message || msg;
    } catch {
      const txt = await r.text().catch(() => "");
      if (txt && !txt.includes("<html")) msg = txt;
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function apiDel(url: string) {
  const r = await fetchAuth(url, { method: "DELETE" });
  if (!r.ok && r.status !== 204) {
    let msg = `HTTP Error ${r.status}`;
    try {
      const data = await r.json();
      msg = data.error || data.message || msg;
    } catch {
      const txt = await r.text().catch(() => "");
      if (txt && !txt.includes("<html")) msg = txt;
    }
    throw new Error(msg);
  }
}

export function fmt(n?: number) {
  return Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
