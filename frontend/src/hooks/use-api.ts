import { useMutation, useQuery } from "@tanstack/react-query";

declare const __WORKER_URL__: string;

function apiBase(): string {
  if (typeof __WORKER_URL__ !== "undefined" && __WORKER_URL__) {
    return __WORKER_URL__;
  }
  return "";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type SearchResult = {
  id: string;
  title: string;
  department?: string;
  date?: string;
  summary?: string;
  score?: number;
  source_url?: string;
  source_format?: string;
};

export type SearchResponse = {
  results: SearchResult[];
  total: number;
};

export type ListItem = {
  id: string;
  title: string;
  department?: string;
  date?: string;
  source_url?: string;
  source_format?: string;
};

export type ListResponse = {
  items: ListItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
};

export type TraceItem = {
  date: string;
  title: string;
  department: string;
  summary: string;
  id: string;
  source_url: string;
};

export type TracePolicyResponse = {
  keyword: string;
  timeline: TraceItem[];
  total: number;
  fallback?: boolean;
};

export type StatsResponse = {
  doc_count: number;
  indexed_count?: number;
  chunk_count?: number;
  fts_rows?: number;
  last_updated?: string;
};

export type HealthResponse = {
  status: string;
  service?: string;
};

export function useSearchGovpress() {
  return useMutation({
    mutationFn: (opts: { data: { query: string; limit?: number; ministry?: string; date_from?: string; date_to?: string } }) =>
      post<SearchResponse>("/api/govpress/search", opts.data),
  });
}

export function useFtsSearchGovpress() {
  return useMutation({
    mutationFn: (opts: { data: { query: string; limit?: number } }) =>
      post<SearchResponse>("/api/govpress/fts", opts.data),
  });
}

export function useListBriefings() {
  return useMutation({
    mutationFn: (opts: { data: { department?: string; date_from?: string; date_to?: string; page?: number; page_size?: number } }) =>
      post<ListResponse>("/api/govpress/list", opts.data),
  });
}

export function useTracePolicy() {
  return useMutation({
    mutationFn: (opts: { data: { keyword: string; date_from?: string; date_to?: string } }) =>
      post<TracePolicyResponse>("/api/govpress/trace", opts.data),
  });
}

export function useGetGovpressStats() {
  return useQuery({
    queryKey: ["govpress-stats"],
    queryFn: () => get<StatsResponse>("/api/govpress/stats"),
  });
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ["healthz"],
    queryFn: () => get<HealthResponse>("/api/healthz"),
    retry: false,
    refetchInterval: 30_000,
  });
}
