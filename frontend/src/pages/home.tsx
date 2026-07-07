import { useState } from "react";
import { useStreamingAsk } from "@/hooks/use-streaming-ask";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SearchResultCard } from "@/components/search-result-card";
import {
  MessageSquare,
  Loader2,
  Sparkles,
  Database,
  ChevronDown,
  ChevronUp,
  Brain,
  Send,
  Info,
  Search,
  CheckCircle2,
  GitCommit,
  FileText,
  Lightbulb,
  RotateCcw,
  ScanSearch,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

type SearchType = "semantic" | "fts" | "trace";

const EXAMPLE_QUESTIONS: { label: string; q: string }[] = [
  { label: "정책 흐름", q: "디지털플랫폼정부 정책이 2022년부터 2026년까지 어떻게 바뀌었는지 설명해줘." },
  { label: "정책 흐름", q: "최근 3년간 탄소중립 정책 흐름을 시계열로 정리해줘." },
  { label: "정책 흐름", q: "우주항공 관련 정책 발표 흐름을 시간순으로 보여주고, 전환점이 된 발표를 짚어줘." },
  { label: "부처 비교", q: "AI 인재양성에 대해 부처별로 목표 숫자나 표현 차이가 있는지 비교해줘." },
  { label: "부처 비교", q: "반도체 인재 관련해서 교육부, 산업부, 과기정통부 입장을 비교해줘." },
  { label: "최신 탐색", q: "기후위기 적응 관련 최신 보도자료 5건을 핵심만 요약해줘." },
  { label: "최신 탐색", q: "전기차 화재 또는 배터리 안전 관련 정부 대응 발표를 모아서 비교해줘." },
  { label: "변화 분석", q: "의대 정원 관련 보도자료 흐름을 정리하고, 시기별로 톤이나 초점이 어떻게 달라졌는지 분석해줘." },
  { label: "변화 분석", q: "저출생 대응 정책에서 최근 1년간 발표가 가장 많은 부처와 핵심 메시지를 정리해줘." },
];

const CATEGORY_COLORS: Record<string, string> = {
  "정책 흐름": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "부처 비교": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "최신 탐색": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "변화 분석": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const STEPS = ["planning", "searching", "reviewing", "answering", "done"] as const;

function Cursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-middle animate-[blink_0.7s_step-end_infinite]" />
  );
}

function MarkdownAnswer({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1;
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-base font-bold mt-4 mb-1">{line.slice(3)}{isLast && streaming && <Cursor />}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-sm font-semibold mt-3 mb-0.5 text-muted-foreground">{line.slice(4)}{isLast && streaming && <Cursor />}</h3>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{formatInline(line.slice(2))}{isLast && streaming && <Cursor />}</span>
            </div>
          );
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split(/\.\s(.+)/);
          return (
            <div key={i} className="flex gap-2">
              <span className="text-primary font-medium shrink-0 min-w-[1.2rem]">{num}.</span>
              <span>{formatInline(rest[0] || "")}{isLast && streaming && <Cursor />}</span>
            </div>
          );
        }
        return <p key={i}>{formatInline(line)}{isLast && streaming && <Cursor />}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
    return part;
  });
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  planning: <Lightbulb className="h-3.5 w-3.5 animate-pulse text-yellow-500" />,
  searching: <Search className="h-3.5 w-3.5 animate-pulse" />,
  reviewing: <ScanSearch className="h-3.5 w-3.5 animate-pulse text-blue-500" />,
  thinking: <Brain className="h-3.5 w-3.5 animate-pulse" />,
  answering: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("semantic");
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const { state, ask, reset } = useStreamingAsk();

  const isActive = state.status !== "idle";
  const isStreaming =
    state.status === "planning" ||
    state.status === "searching" ||
    state.status === "reviewing" ||
    state.status === "thinking" ||
    state.status === "answering";

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isStreaming) return;
    setThinkingOpen(true);
    setSourcesOpen(true);
    ask({ question, search_type: searchType, limit: 5 });
  };

  const handleExample = (ex: typeof EXAMPLE_QUESTIONS[0]) => {
    setQuestion(ex.q);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Page header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <MessageSquare className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">AI 정책 분석</h1>
        </div>
        <p className="text-xs text-muted-foreground pl-[1.85rem]">
          GovPress 13만 건 정책브리핑 검색 후 MiniMax AI가 출처를 인용해 답변합니다.
        </p>
      </div>

      {/* Query form */}
      <div className="mb-4 border border-primary/20 rounded-xl bg-card shadow-sm p-3 sm:p-4">
        <form onSubmit={handleAsk} className="space-y-2.5">
          <Textarea
            id="question"
            data-testid="input-question"
            placeholder="예: 디지털플랫폼정부 정책이 2022년부터 어떻게 바뀌었나요?"
            className="min-h-[72px] resize-none text-sm bg-background w-full"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAsk(e as unknown as React.FormEvent);
            }}
          />
          <div className="flex items-center gap-2">
            <Select value={searchType} onValueChange={(val) => setSearchType(val as SearchType)}>
              <SelectTrigger className="h-9 text-xs bg-background flex-1 sm:flex-none sm:w-44" data-testid="select-search-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semantic">
                  <div className="flex items-center gap-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    의미 검색
                  </div>
                </SelectItem>
                <SelectItem value="fts">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 text-orange-500" />
                    키워드 (FTS)
                  </div>
                </SelectItem>
                <SelectItem value="trace">
                  <div className="flex items-center gap-2 text-xs">
                    <GitCommit className="h-3.5 w-3.5 text-green-500" />
                    정책 흐름
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              className="h-9 text-xs px-5 shrink-0"
              disabled={isStreaming || !question.trim()}
              data-testid="button-ask-submit"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">분석</span>
            </Button>
            {isActive && !isStreaming && (
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
              >
                초기화
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground hidden sm:block">Ctrl+Enter 또는 Cmd+Enter로 전송</p>
        </form>
      </div>

      {/* Example questions */}
      {!isActive && (
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Info className="h-3 w-3" />
            질문 예시 (클릭하여 바로 사용)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUESTIONS.map((ex, i) => (
              <button
                key={i}
                data-testid={`button-example-${i}`}
                onClick={() => handleExample(ex)}
                className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors text-left"
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[ex.label]}`}>
                  {ex.label}
                </span>
                <span className="text-foreground/80 max-w-[180px] sm:max-w-[240px] truncate">{ex.q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isActive && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 px-0.5">
            <div className="flex gap-1">
              {STEPS.map((step) => {
                const idx = STEPS.indexOf(step);
                const cur = STEPS.indexOf(state.status as typeof STEPS[number]);
                return (
                  <div
                    key={step}
                    className={`h-1 w-5 sm:w-7 rounded-full transition-all duration-500 ${idx <= cur ? "bg-primary" : "bg-muted"}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              {STATUS_ICONS[state.status] ?? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
              <span className="truncate">{state.statusMessage || "처리 중..."}</span>
            </div>
            {state.status === "done" && (
              <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <span className="font-mono bg-muted px-1 py-0.5 rounded hidden sm:inline">{state.model}</span>
                <span className="bg-muted px-1 py-0.5 rounded">{state.tokensUsed}tok</span>
              </div>
            )}
          </div>

          {/* Plan info pill */}
          {state.planQuery && (
            <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/40 rounded-lg text-xs">
              <Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {state.planTool && (
                    <span className="inline-block bg-yellow-200 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                      {state.planTool}
                    </span>
                  )}
                  {(state.planDateFrom || state.planDateTo) && (
                    <span className="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-mono text-[10px]">
                      {state.planDateFrom || "…"} ~ {state.planDateTo || "…"}
                    </span>
                  )}
                  <span className="text-yellow-800 dark:text-yellow-200 font-mono">{state.planQuery}</span>
                </div>
                {state.planStrategy && (
                  <div className="text-yellow-600 dark:text-yellow-400">{state.planStrategy}</div>
                )}
              </div>
            </div>
          )}

          {/* Review info pill (only when retrying) */}
          {state.reviewSufficient === false && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-lg text-xs">
              <RotateCcw className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="text-blue-700 dark:text-blue-300">
                <span className="font-medium">검토 결과:</span> {state.reviewReason} — 쿼리를 개선해 재검색합니다.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result area */}
      {isActive && (
        <div className="space-y-4">
          {/* Desktop: side-by-side / Mobile: stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: thinking + answer */}
            <div className="lg:col-span-2 space-y-4">
              {/* Thinking block */}
              {(state.thinking || state.status === "thinking") && (
                <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
                  <div className="border border-violet-200 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 rounded-xl overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
                        data-testid="button-toggle-thinking"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Brain className={`h-4 w-4 text-violet-500 shrink-0 ${state.status === "thinking" ? "animate-pulse" : ""}`} />
                          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI 추론 과정</span>
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300 hidden sm:flex">
                            MiniMax M2.7
                          </Badge>
                          {state.status === "thinking" && <Loader2 className="h-3 w-3 animate-spin text-violet-400 shrink-0" />}
                        </div>
                        {thinkingOpen ? <ChevronUp className="h-4 w-4 text-violet-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-violet-400 shrink-0" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-1 border-t border-violet-100 dark:border-violet-900/40">
                        <div
                          className="text-xs text-violet-700/80 dark:text-violet-300/70 leading-relaxed whitespace-pre-wrap font-mono bg-violet-50 dark:bg-violet-950/30 p-3 rounded-md max-h-48 sm:max-h-64 overflow-y-auto"
                          data-testid="text-thinking"
                        >
                          {state.thinking || ""}
                          {state.status === "thinking" && <Cursor />}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Answer block */}
              {(state.answer || state.status === "answering") && (
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI 분석 결과
                  </h2>
                  <div className="border rounded-xl bg-card p-4 sm:p-5">
                    {state.answer ? (
                      <MarkdownAnswer text={state.answer} streaming={state.status === "answering"} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        답변 생성 중...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Planning / Searching skeleton */}
              {(state.status === "planning" || state.status === "searching" || state.status === "reviewing") && !state.answer && !state.thinking && (
                <div className="border rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {state.status === "planning" && <Lightbulb className="h-4 w-4 animate-pulse text-yellow-500" />}
                    {state.status === "searching" && <Search className="h-4 w-4 animate-pulse text-primary" />}
                    {state.status === "reviewing" && <ScanSearch className="h-4 w-4 animate-pulse text-blue-500" />}
                    <span>{state.statusMessage || "처리 중..."}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right / Bottom: Sources */}
            <div className="lg:col-span-1">
              {/* Mobile: collapsible sources */}
              <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen} className="lg:hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between py-2 text-sm font-semibold">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-primary" />
                      {state.sources.length > 0
                        ? `참고 보도자료 (${state.sources.length}건)`
                        : "보도자료 검색 중..."}
                    </div>
                    {sourcesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 pt-1">
                    {state.sources.length === 0 ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
                      ))
                    ) : (
                      state.sources.map((source) => (
                        <SearchResultCard key={source.id} result={source} />
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Desktop: always-visible sources */}
              <div className="hidden lg:block space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-primary" />
                  {state.sources.length > 0
                    ? `참고 보도자료 (${state.sources.length}건)`
                    : "보도자료 검색 중..."}
                </h2>
                {state.sources.length === 0 ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  state.sources.map((source) => (
                    <SearchResultCard key={source.id} result={source} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {state.status === "error" && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 text-sm text-destructive">
              {state.errorMessage || "오류가 발생했습니다. 잠시 후 다시 시도해주세요."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
