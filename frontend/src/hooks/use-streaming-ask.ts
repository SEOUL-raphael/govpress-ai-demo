import { useState, useCallback, useRef } from "react";

declare const __WORKER_URL__: string;

type SearchResult = {
  id: string;
  title: string;
  department?: string;
  date?: string;
  summary?: string;
  score?: number;
};

export type StreamingState = {
  status: "idle" | "planning" | "searching" | "reviewing" | "thinking" | "answering" | "done" | "error";
  statusMessage: string;
  // Plan
  planQuery: string;
  planStrategy: string;
  planTool: string;
  planDateFrom: string;
  planDateTo: string;
  // Review
  reviewSufficient: boolean | null;
  reviewReason: string;
  attempt: number;
  // Result
  thinking: string;
  answer: string;
  sources: SearchResult[];
  model: string;
  tokensUsed: number;
  errorMessage: string;
};

const INITIAL: StreamingState = {
  status: "idle",
  statusMessage: "",
  planQuery: "",
  planStrategy: "",
  planTool: "",
  planDateFrom: "",
  planDateTo: "",
  reviewSufficient: null,
  reviewReason: "",
  attempt: 0,
  thinking: "",
  answer: "",
  sources: [],
  model: "",
  tokensUsed: 0,
  errorMessage: "",
};

export function useStreamingAsk() {
  const [state, setState] = useState<StreamingState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (params: {
      question: string;
      search_type?: "semantic" | "fts" | "trace";
      limit?: number;
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        ...INITIAL,
        status: "planning",
        statusMessage: "검색 전략 수립 중...",
      });

      try {
        const apiBase = typeof __WORKER_URL__ !== "undefined" && __WORKER_URL__ ? __WORKER_URL__ : "";
        const res = await fetch(`${apiBase}/api/chat/ask-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: params.question,
            search_type: params.search_type ?? "semantic",
            limit: params.limit ?? 5,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const decoder = new TextDecoder();
        const reader = res.body.getReader();
        let buffer = "";
        let pendingEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              pendingEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const json = line.slice(6).trim();
              try {
                const payload = JSON.parse(json);
                handleEvent(pendingEvent, payload);
              } catch {
                // ignore
              }
              pendingEvent = "";
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({
          ...s,
          status: "error",
          errorMessage: (err as Error).message || "알 수 없는 오류",
        }));
      }

      function handleEvent(event: string, payload: Record<string, unknown>) {
        switch (event) {
          case "status": {
            const step = payload.step as string;
            const message = payload.message as string;
            const statusMap: Record<string, StreamingState["status"]> = {
              planning: "planning",
              searching: "searching",
              reviewing: "reviewing",
              thinking: "thinking",
              answering: "answering",
            };
            setState((s) => ({
              ...s,
              status: statusMap[step] ?? s.status,
              statusMessage: message,
            }));
            break;
          }
          case "plan": {
            setState((s) => ({
              ...s,
              planQuery: (payload.query as string) || "",
              planStrategy: (payload.strategy as string) || "",
              planTool: (payload.tool as string) || "",
              planDateFrom: (payload.date_from as string) || "",
              planDateTo: (payload.date_to as string) || "",
            }));
            break;
          }
          case "sources": {
            setState((s) => ({
              ...s,
              sources: (payload.sources as SearchResult[]) ?? [],
            }));
            break;
          }
          case "review": {
            setState((s) => ({
              ...s,
              reviewSufficient: payload.sufficient as boolean,
              reviewReason: (payload.reason as string) || "",
              attempt: (payload.attempt as number) || s.attempt,
            }));
            break;
          }
          case "thinking_delta": {
            setState((s) => ({
              ...s,
              status: "thinking",
              thinking: s.thinking + (payload.text as string),
            }));
            break;
          }
          case "text_delta": {
            setState((s) => ({
              ...s,
              status: "answering",
              statusMessage: "답변 생성 중...",
              answer: s.answer + (payload.text as string),
            }));
            break;
          }
          case "done": {
            setState((s) => ({
              ...s,
              status: "done",
              model: (payload.model as string) || "MiniMax-M2.7",
              tokensUsed: (payload.tokens_used as number) || 0,
            }));
            break;
          }
          case "error": {
            setState((s) => ({
              ...s,
              status: "error",
              errorMessage: (payload.message as string) || "오류가 발생했습니다.",
            }));
            break;
          }
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { state, ask, reset };
}
