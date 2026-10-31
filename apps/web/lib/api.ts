"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type User = { id: string; email: string; name: string; has_delegate: boolean; delegate_handle: string | null };

const TOKEN_KEY = "argumente.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) window.localStorage.setItem(TOKEN_KEY, t);
  else window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("argumente-auth"));
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the Argumenté API. Is the backend running on port 8000?");
  }
  if (res.status === 401) {
    setToken(null);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const d = data?.detail;
    if (Array.isArray(d)) throw new ApiError(res.status, "VALIDATION", d.map((x: any) => x.msg).join("; "));
    throw new ApiError(res.status, d?.code ?? "ERROR", d?.message ?? (typeof d === "string" ? d : `Request failed (${res.status})`));
  }
  return data as T;
}

export function useMe() {
  const [me, setMe] = useState<User | null | undefined>(undefined);
  const load = useCallback(async () => {
    if (!getToken()) return setMe(null);
    try {
      setMe(await api<User>("/me"));
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("argumente-auth", h);
    return () => window.removeEventListener("argumente-auth", h);
  }, [load]);
  return { me, reload: load };
}

/** Fetch + poll (every `ms`) while mounted. Polling keeps every participant's screen in sync. */
export function usePoll<T>(path: string | null, ms = 2000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e as ApiError);
    }
  }, [path]);
  useEffect(() => {
    alive.current = true;
    load();
    if (!ms) return;
    const id = setInterval(load, ms);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, ms]);
  return { data, setData, error, reload: load };
}
