// GovPress AI Worker — Cloudflare Worker
// All /api/* requests handled here; forward MCP and MiniMax calls server-side.

const GOVPRESS_MCP_URL = "https://mcp.govpress.cloud/mcp";
const MINIMAX_ENDPOINT = "https://api.minimax.io/anthropic/v1/messages";
const MINIMAX_MODEL = "claude-3-5-haiku-20241022";

interface Env {
  MINIMAX_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

// ── CORS helper ──────────────────────────────────────────────────────────────

function corsHeaders(origin: string, allowed: string): HeadersInit {
  const allowedOrigins = [allowed, "http://localhost:5173", "http://localhost:4173"];
  const useOrigin = allowedOrigins.includes(origin) ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": useOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// ── MCP helper ───────────────────────────────────────────────────────────────

type McpItem = {
  news_item_id?: string;
  title?: string;
  subject?: string;
  department?: string;
  ministry?: string;
  approve_date?: string;
  date?: string;
  published_at?: string;
  score?: number;
  similarity?: number;
  snippet?: string;
  summary?: string;
  content_preview?: string;
  chunk_id?: string;
  source_url?: string;
};

async function callMcp(method: string, params: Record<string, unknown>): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: method, arguments: params },
  };

  const res = await fetch(GOVPRESS_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`MCP call failed: ${res.status}`);

  const data = await res.json() as {
    result?: { content?: Array<{ type: string; text: string }>; isError?: boolean };
    error?: { message: string };
  };

  if (data.error) throw new Error(`MCP error: ${data.error.message}`);
  const content = data.result?.content;
  if (!content || content.length === 0) return null;

  const textContent = content.find((c) => c.type === "text");
  if (!textContent) return null;

  const raw = textContent.text.trim();
  if (!raw.startsWith("{") && !raw.startsWith("[")) {
    throw new Error(`MCP returned non-JSON: ${raw.slice(0, 120)}`);
  }

  const parsed = JSON.parse(raw) as { data?: unknown; error?: string | null };
  if (parsed.error && !parsed.data) throw new Error(`MCP data error: ${String(parsed.error)}`);
  return parsed.data ?? parsed;
}

// ── Normalize helpers ────────────────────────────────────────────────────────

function normalizeItem(item: McpItem, index: number) {
  return {
    id: String(item.news_item_id || item.chunk_id || index),
    title: String(item.title || item.subject || "제목 없음"),
    department: String(item.department || item.ministry || ""),
    date: String(item.approve_date || item.date || item.published_at || "").slice(0, 10),
    summary: String(item.snippet || item.summary || item.content_preview || "").slice(0, 300),
    score: Number(item.score || item.similarity || 0),
  };
}

function normalizeSearchResults(raw: unknown): { results: ReturnType<typeof normalizeItem>[]; total: number } {
  if (!raw || typeof raw !== "object") return { results: [], total: 0 };
  const r = raw as Record<string, unknown>;
  const items: McpItem[] = Array.isArray(r.items)
    ? (r.items as McpItem[])
    : Array.isArray(r.results)
      ? (r.results as McpItem[])
      : Array.isArray(raw)
        ? (raw as McpItem[])
        : [];
  const results = items.map((item, i) => normalizeItem(item, i));
  return { results, total: results.length };
}

// ── MiniMax sync helper ──────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function callMinimaxSync(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const body = JSON.stringify({
    model: MINIMAX_MODEL,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 512,
  });
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(MINIMAX_ENDPOINT, { method: "POST", headers, body });
    if ((res.status === 529 || res.status === 503 || res.status === 502) && attempt < 4) {
      await sleep(attempt * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`MiniMax error: ${res.status}`);
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((c) => c.type === "text")?.text ?? "";
  }
  throw new Error("MiniMax 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.");
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { return {}; }
}

// ── Types ────────────────────────────────────────────────────────────────────

type McpTool = "search_briefing" | "fts_search" | "trace_policy" | "cross_check_ministries";

type Source = {
  id: string;
  title: string;
  department?: string;
  date?: string;
  summary?: string;
  score?: number;
};

type PlanResult = {
  query: string;
  strategy: string;
  tool: McpTool;
  date_from?: string;
  date_to?: string;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function validDate(val: unknown): string | undefined {
  if (typeof val !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(val.trim()) ? val.trim() : undefined;
}

function normalizeSearchSources(raw: unknown): Source[] {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  const items: McpItem[] = Array.isArray(r.items)
    ? (r.items as McpItem[])
    : Array.isArray(r.results)
      ? (r.results as McpItem[])
      : Array.isArray(raw)
        ? (raw as McpItem[])
        : [];
  return items.map(normalizeItem);
}

function normalizeTracePolicy(raw: unknown): Source[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Record<string, unknown>;
  const nodes: McpItem[] = Array.isArray(d.nodes) ? (d.nodes as McpItem[]) : [];
  return nodes.map(normalizeItem);
}

function normalizeCrossCheck(raw: unknown): Source[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Record<string, unknown>;
  const items: McpItem[] = Array.isArray(d.items) ? (d.items as McpItem[]) : [];
  return items.map(normalizeItem);
}

async function executeMcpSearch(
  tool: McpTool,
  query: string,
  limit: number,
  dateFrom?: string,
  dateTo?: string,
): Promise<Source[]> {
  if (tool === "search_briefing") {
    const args: Record<string, unknown> = { query, limit };
    if (dateFrom) args.date_from = dateFrom;
    if (dateTo) args.date_to = dateTo;
    try {
      const data = await callMcp("search_briefing", args);
      return normalizeSearchSources(data);
    } catch {
      const data = await callMcp("fts_search", { query, limit });
      return normalizeSearchSources(data);
    }
  }
  if (tool === "fts_search") {
    const data = await callMcp("fts_search", { query, limit });
    return normalizeSearchSources(data);
  }
  if (tool === "trace_policy") {
    const args: Record<string, unknown> = {
      keyword: query,
      date_from: dateFrom || "2021-04-01",
      date_to: dateTo || todayString(),
    };
    try {
      const data = await callMcp("trace_policy", args);
      return normalizeTracePolicy(data);
    } catch {
      const data = await callMcp("fts_search", { query, limit });
      return normalizeSearchSources(data);
    }
  }
  if (tool === "cross_check_ministries") {
    const args: Record<string, unknown> = { topic: query, min_ministries: 2 };
    if (dateFrom) args.date_from = dateFrom;
    if (dateTo) args.date_to = dateTo;
    try {
      const data = await callMcp("cross_check_ministries", args);
      return normalizeCrossCheck(data);
    } catch {
      const data = await callMcp("fts_search", { query, limit });
      return normalizeSearchSources(data);
    }
  }
  return [];
}

async function planSearch(question: string, userSearchType: string, apiKey: string): Promise<PlanResult> {
  const today = todayString();
  const text = await callMinimaxSync(
    apiKey,
    "You are an expert at querying Korean government briefing databases. Always respond in Korean.",
    `오늘 날짜: ${today}
사용자가 선택한 검색 방식: ${userSearchType}
사용자 질문: "${question}"

아래 4가지 MCP 도구 중 이 질문에 가장 적합한 도구 하나를 선택하고, 최적의 검색 쿼리를 생성하세요.

도구 설명:
- search_briefing: 의미 기반 벡터 검색. 자연어 문장·개념 검색에 최적 (일반적 정책 질문)
- fts_search: 정확한 키워드 전문 검색. 고유명사·특정 단어가 포함된 문서 검색에 최적
- trace_policy: 정책 시계열 흐름 추적. "언제부터", "어떻게 변화", "흐름", "추이" 등의 질문에 최적 (keyword 파라미터 사용)
- cross_check_ministries: 여러 부처 입장 교차 비교. "부처별 차이", "비교", "어느 부처" 등에 최적

선택 가이드:
- 사용자가 "정책 흐름"을 선택했거나 흐름·변화·타임라인 관련 질문이면 trace_policy
- 사용자가 "키워드(FTS)"를 선택했거나 특정 단어가 핵심이면 fts_search
- "부처", "비교", "차이"가 핵심이면 cross_check_ministries
- 그 외에는 search_briefing

날짜 추출 규칙:
- 질문에 연도/기간이 언급되면 date_from, date_to를 YYYY-MM-DD 형식으로 추출
- "2022년부터" → date_from: "2022-01-01", date_to: 오늘
- "최근 1년" → date_from: 1년 전, date_to: 오늘
- trace_policy는 date_from, date_to를 반드시 포함할 것 (없으면 "2021-04-01" ~ 오늘)
- 날짜 언급 없으면 date_from, date_to는 null

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{"tool": "search_briefing|fts_search|trace_policy|cross_check_ministries", "query": "검색 쿼리 또는 핵심 키워드", "strategy": "선택 이유 한 줄", "date_from": "YYYY-MM-DD 형식 또는 null", "date_to": "YYYY-MM-DD 형식 또는 null"}`,
  );

  const parsed = extractJson(text);
  const validTools: McpTool[] = ["search_briefing", "fts_search", "trace_policy", "cross_check_ministries"];
  const tool = validTools.includes(parsed.tool as McpTool) ? (parsed.tool as McpTool) : "search_briefing";

  let dateFrom = validDate(parsed.date_from);
  let dateTo = validDate(parsed.date_to);
  if (tool === "trace_policy") {
    if (!dateFrom) dateFrom = "2021-04-01";
    if (!dateTo) dateTo = today;
  }

  return {
    query: (parsed.query as string) || question,
    strategy: (parsed.strategy as string) || "",
    tool,
    date_from: dateFrom,
    date_to: dateTo,
  };
}

async function reviewResults(question: string, sources: Source[], apiKey: string): Promise<{ sufficient: boolean; reason: string; refined_query?: string }> {
  if (sources.length === 0) {
    return { sufficient: false, reason: "검색 결과 없음", refined_query: question };
  }

  const summary = sources
    .slice(0, 5)
    .map((s, i) => `[${i + 1}] ${s.title} (${s.department}, ${s.date})\n${s.summary?.slice(0, 120) ?? ""}`)
    .join("\n\n");

  const text = await callMinimaxSync(
    apiKey,
    "You are an expert at evaluating Korean government briefing search quality. Always respond in Korean.",
    `질문: "${question}"

검색 결과 ${sources.length}건:
${summary}

이 결과가 질문에 충분히 답하기에 적합한가요?
기준: 관련성, 구체성, 결과 수(3건 이상이면 보통 충분)

반드시 아래 JSON 형식으로만 응답하세요:
{"sufficient": true/false, "reason": "판단 이유 한 줄", "refined_query": "불충분할 때 의미 검색으로 재시도할 쿼리 (충분하면 생략)"}`,
  );

  const parsed = extractJson(text);
  return {
    sufficient: Boolean(parsed.sufficient),
    reason: (parsed.reason as string) || "",
    refined_query: (parsed.refined_query as string) || undefined,
  };
}

// ── SSE streaming helper for Cloudflare Workers ──────────────────────────────

function createSSEStream(
  handler: (send: (event: string, data: unknown) => void) => Promise<void>,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (event: string, data: unknown) => {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(chunk)).catch(() => {});
  };

  handler(send)
    .catch((err) => {
      send("error", { message: (err as Error).message || "서버 오류" });
    })
    .finally(() => {
      writer.close().catch(() => {});
    });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleHealthz(): Promise<Response> {
  return jsonResponse({ status: "ok", service: "govpress-ai-worker" });
}

async function handleStats(cors: HeadersInit): Promise<Response> {
  try {
    const data = await callMcp("get_stats", {});
    if (!data) return jsonResponse({ doc_count: 0 }, 200, cors);
    const d = data as Record<string, unknown>;
    return jsonResponse({
      doc_count: Number(d.doc_count || 0),
      indexed_count: Number(d.indexed_docs || d.indexed_count || 0),
      chunk_count: Number(d.qdrant_points_count || d.briefing_fts_rows || d.chunk_count || 0),
      fts_rows: Number(d.briefing_fts_rows || d.fts_rows || 0),
      last_updated: String(d.approve_date_max || d.last_updated || ""),
    }, 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

async function handleSearch(body: unknown, cors: HeadersInit): Promise<Response> {
  const b = body as { query?: string; limit?: number; date_from?: string; date_to?: string; ministry?: string };
  if (!b.query) return jsonResponse({ error: "query is required" }, 400, cors);

  try {
    const params: Record<string, unknown> = { query: b.query, limit: b.limit ?? 5 };
    if (b.date_from) params.date_from = b.date_from;
    if (b.date_to) params.date_to = b.date_to;
    if (b.ministry) params.ministry = b.ministry;

    let data: unknown;
    try {
      data = await callMcp("search_briefing", params);
    } catch {
      data = await callMcp("fts_search", { query: b.query, limit: b.limit ?? 5 });
    }
    return jsonResponse(normalizeSearchResults(data), 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

async function handleFts(body: unknown, cors: HeadersInit): Promise<Response> {
  const b = body as { query?: string; limit?: number };
  if (!b.query) return jsonResponse({ error: "query is required" }, 400, cors);

  try {
    const data = await callMcp("fts_search", { query: b.query, limit: b.limit ?? 5 });
    return jsonResponse(normalizeSearchResults(data), 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

async function handleList(body: unknown, cors: HeadersInit): Promise<Response> {
  const b = body as { department?: string; date_from?: string; date_to?: string; page?: number; page_size?: number };

  type ListItem = {
    news_item_id?: string;
    title?: string;
    department?: string;
    approve_date?: string;
    source_url?: string;
    source_format?: string;
  };

  try {
    const params: Record<string, unknown> = { page: b.page ?? 1, page_size: b.page_size ?? 20 };
    if (b.department) params.department = b.department;
    if (b.date_from) params.date_from = b.date_from;
    if (b.date_to) params.date_to = b.date_to;

    const data = await callMcp("list_briefings", params);
    if (!data || typeof data !== "object") {
      return jsonResponse({ items: [], total: 0, page: b.page ?? 1, page_size: b.page_size ?? 20, has_more: false }, 200, cors);
    }
    const d = data as Record<string, unknown>;
    const rawItems: ListItem[] = Array.isArray(d.items) ? (d.items as ListItem[]) : [];

    return jsonResponse({
      items: rawItems.map((item) => ({
        id: String(item.news_item_id || ""),
        title: String(item.title || "제목 없음"),
        department: String(item.department || ""),
        date: String(item.approve_date || "").slice(0, 10),
        source_url: String(item.source_url || ""),
        source_format: String(item.source_format || ""),
      })),
      total: Number(d.total || 0),
      page: Number(d.page || b.page || 1),
      page_size: Number(d.page_size || b.page_size || 20),
      has_more: Boolean(d.has_more ?? false),
    }, 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

async function handleTrace(body: unknown, cors: HeadersInit): Promise<Response> {
  const b = body as { keyword?: string; date_from?: string; date_to?: string };
  if (!b.keyword) return jsonResponse({ error: "keyword is required" }, 400, cors);

  type TraceItem = {
    approve_date?: string;
    date?: string;
    published_at?: string;
    title?: string;
    subject?: string;
    department?: string;
    ministry?: string;
    snippet?: string;
    summary?: string;
    content_preview?: string;
    news_item_id?: string;
    id?: string;
    chunk_id?: string;
    source_url?: string;
    score?: number;
  };

  function buildTimeline(rawItems: TraceItem[]) {
    return rawItems
      .map((item) => ({
        date: String(item.approve_date || item.date || item.published_at || "").slice(0, 10),
        title: String(item.title || item.subject || ""),
        department: String(item.department || item.ministry || ""),
        summary: String(item.snippet || item.summary || item.content_preview || "").slice(0, 200),
        id: String(item.news_item_id || item.id || item.chunk_id || ""),
        source_url: String(item.source_url || ""),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  try {
    const params: Record<string, unknown> = { keyword: b.keyword };
    if (b.date_from) params.date_from = b.date_from;
    if (b.date_to) params.date_to = b.date_to;

    let timeline: ReturnType<typeof buildTimeline> = [];
    let usedFallback = false;

    try {
      const data = await callMcp("trace_policy", params);
      if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        const rawItems = Array.isArray(d.nodes)
          ? (d.nodes as TraceItem[])
          : Array.isArray(d.items)
            ? (d.items as TraceItem[])
            : Array.isArray(d.timeline)
              ? (d.timeline as TraceItem[])
              : [];
        timeline = buildTimeline(rawItems);
      }
    } catch {
      usedFallback = true;
      const ftsData = await callMcp("fts_search", { query: b.keyword, limit: 30 });
      if (ftsData && typeof ftsData === "object") {
        const d = ftsData as Record<string, unknown>;
        const rawItems = Array.isArray(d.items) ? (d.items as TraceItem[]) : [];
        timeline = buildTimeline(rawItems);
      }
    }

    return jsonResponse({ keyword: b.keyword, timeline, total: timeline.length, fallback: usedFallback }, 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

async function handleAskStream(body: unknown, apiKey: string): Promise<Response> {
  const b = body as { question?: string; search_type?: string; limit?: number };
  if (!b.question) {
    return new Response(JSON.stringify({ error: "question is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const question = b.question;
  const searchType = b.search_type ?? "semantic";
  const limit = b.limit ?? 5;

  return createSSEStream(async (send) => {
    const MAX_ATTEMPTS = 2;
    let sources: Source[] = [];
    let currentQuery = question;
    let currentTool: McpTool = "search_briefing";
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalModel = "MiniMax-M2.7";

    // PLAN
    send("status", { step: "planning", message: "검색 전략 수립 중..." });
    const plan = await planSearch(question, searchType, apiKey);
    currentQuery = plan.query;
    currentTool = plan.tool;
    let planDateFrom = plan.date_from;
    let planDateTo = plan.date_to;
    send("plan", {
      query: plan.query,
      strategy: plan.strategy,
      tool: plan.tool,
      date_from: plan.date_from,
      date_to: plan.date_to,
    });

    // EXECUTE → REVIEW loop
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const toolLabel: Record<McpTool, string> = {
        search_briefing: "의미 검색",
        fts_search: "키워드 검색",
        trace_policy: "정책 흐름 추적",
        cross_check_ministries: "부처 교차 비교",
      };
      send("status", {
        step: "searching",
        message: attempt === 1
          ? `GovPress ${toolLabel[currentTool]} 중...`
          : `재검색 중 (${attempt}차)...`,
      });

      let newSources: Source[] = [];
      try {
        newSources = await executeMcpSearch(currentTool, currentQuery, limit, planDateFrom, planDateTo);
      } catch {
        send("status", { step: "searching", message: "GovPress 검색 오류, 빈 결과로 계속합니다." });
      }

      const seenIds = new Set(sources.map((s) => s.id));
      for (const s of newSources) {
        if (!seenIds.has(s.id)) { sources.push(s); seenIds.add(s.id); }
      }

      send("sources", { sources });

      if (attempt >= MAX_ATTEMPTS) break;

      // REVIEW
      send("status", { step: "reviewing", message: "검색 결과 검토 중..." });
      const review = await reviewResults(question, sources, apiKey);
      send("review", { sufficient: review.sufficient, reason: review.reason, attempt });

      if (review.sufficient) break;
      if (review.refined_query && review.refined_query !== currentQuery) {
        currentQuery = review.refined_query;
        currentTool = "search_briefing";
        planDateFrom = undefined;
        planDateTo = undefined;
      } else {
        break;
      }
    }

    // ANSWER (streaming)
    send("status", { step: "thinking", message: "AI 추론 및 답변 생성 중..." });

    const contextText = sources.length > 0
      ? sources
          .map((s, i) => `[${i + 1}] ${s.title}\n부처: ${s.department || "불명"} | 날짜: ${s.date || "불명"}\n${s.summary || ""}`)
          .join("\n\n")
      : "관련 보도자료를 찾지 못했습니다.";

    const systemPrompt = `당신은 대한민국 정부 정책 전문가 AI 어시스턴트입니다.
절대적 규칙: 반드시 한국어로만 답변하세요. 한자·중국어·일본어·영어를 사용하지 마세요. 순한국어만 사용합니다.
정책브리핑 보도자료 데이터베이스(GovPress)를 기반으로 사용자의 질문에 정확하고 유익한 답변을 제공하세요.
제공된 보도자료를 근거로 답변하며, 출처를 [1], [2] 번호로 인용하세요.`;

    const userMessage = `[중요: 반드시 순한국어로만 답변하세요. 한자·중국어를 절대 사용하지 마세요.]

다음은 관련 정부 보도자료입니다:

${contextText}

위 내용을 참고하여 다음 질문에 한국어로 답변해 주세요:
${question}`;

    let minimaxRes: Response | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      minimaxRes = await fetch(MINIMAX_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
          max_tokens: 2048,
          stream: true,
        }),
      });
      if ((minimaxRes.status === 529 || minimaxRes.status === 503 || minimaxRes.status === 502) && attempt < 4) {
        await sleep(attempt * 1500);
        continue;
      }
      break;
    }

    if (!minimaxRes || !minimaxRes.ok || !minimaxRes.body) {
      const errText = minimaxRes ? await minimaxRes.text() : "";
      const code = minimaxRes?.status;
      send("error", {
        message: code === 529
          ? "MiniMax 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요."
          : `MiniMax API error: ${code} ${errText.slice(0, 120)}`,
      });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of minimaxRes.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const evt = JSON.parse(jsonStr) as {
              type: string;
              delta?: { type: string; text?: string; thinking?: string };
              message?: { model?: string; usage?: { input_tokens: number } };
              usage?: { output_tokens: number };
            };

            if (evt.type === "message_start" && evt.message?.model) {
              finalModel = evt.message.model;
              totalInputTokens += evt.message.usage?.input_tokens ?? 0;
            } else if (evt.type === "content_block_delta") {
              const delta = evt.delta;
              if (delta?.type === "thinking_delta" && delta.thinking) {
                send("thinking_delta", { text: delta.thinking });
              } else if (delta?.type === "text_delta" && delta.text) {
                send("text_delta", { text: delta.text });
              }
            } else if (evt.type === "message_delta" && evt.usage) {
              totalOutputTokens += evt.usage.output_tokens ?? 0;
            }
          } catch { /* ignore */ }
        }
      }
    }

    send("done", { model: finalModel, tokens_used: totalInputTokens + totalOutputTokens });
  });
}

async function handleBriefing(id: string, maxChars: number, cors: HeadersInit): Promise<Response> {
  try {
    const mcpBody = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: "get_briefing", arguments: { id, max_chars: maxChars } },
    };

    const mcpRes = await fetch(GOVPRESS_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpBody),
    });

    if (!mcpRes.ok) return jsonResponse({ error: `MCP error: ${mcpRes.status}` }, 502, cors);

    const mcpData = await mcpRes.json() as {
      result?: { content?: Array<{ type: string; text: string }>; isError?: boolean };
      error?: { message: string };
    };

    if (mcpData.error) return jsonResponse({ error: mcpData.error.message }, 502, cors);

    const textContent = mcpData.result?.content?.find((c) => c.type === "text");
    if (!textContent) return jsonResponse({ error: "보도자료를 찾을 수 없습니다." }, 404, cors);

    let parsed: unknown;
    try {
      parsed = JSON.parse(textContent.text);
    } catch {
      return jsonResponse({ id, content: textContent.text }, 200, cors);
    }

    return jsonResponse(parsed, 200, cors);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500, cors);
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const path = url.pathname;

    // Health check
    if (path === "/api/healthz" && request.method === "GET") {
      return handleHealthz();
    }

    // Govpress stats
    if (path === "/api/govpress/stats" && request.method === "GET") {
      return handleStats(cors);
    }

    // Briefing detail
    const briefingMatch = path.match(/^\/api\/chat\/briefing\/(.+)$/);
    if (briefingMatch && request.method === "GET") {
      const id = briefingMatch[1];
      const maxChars = Number(url.searchParams.get("max_chars") || "8000");
      return handleBriefing(id, maxChars, cors);
    }

    // POST routes need body
    if (request.method !== "POST") {
      return jsonResponse({ error: "Not found" }, 404, cors);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400, cors);
    }

    if (!env.MINIMAX_API_KEY && path === "/api/chat/ask-stream") {
      return jsonResponse({ error: "MINIMAX_API_KEY not configured" }, 500, cors);
    }

    if (path === "/api/govpress/search") return handleSearch(body, cors);
    if (path === "/api/govpress/fts") return handleFts(body, cors);
    if (path === "/api/govpress/list") return handleList(body, cors);
    if (path === "/api/govpress/trace") return handleTrace(body, cors);
    if (path === "/api/chat/ask-stream") return handleAskStream(body, env.MINIMAX_API_KEY);

    return jsonResponse({ error: "Not found" }, 404, cors);
  },
};
