import { useState } from "react";
import { useTracePolicy } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCommit, CalendarIcon, Building2, Info, ExternalLink } from "lucide-react";

const TRACE_EXAMPLES = [
  "디지털플랫폼정부",
  "탄소중립",
  "AI 인재양성",
  "우주항공",
  "저출생",
  "의대 정원",
];

export default function TracePage() {
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const tracePolicy = useTracePolicy();

  const handleTrace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    tracePolicy.mutate({
      data: {
        keyword,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
    });
  };

  const timeline = tracePolicy.data?.timeline ?? [];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <GitCommit className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">정책 흐름 추적</h1>
        </div>
        <p className="text-xs text-muted-foreground pl-[1.85rem]">
          키워드로 정책이 시간에 따라 어떻게 변화했는지 시계열로 확인합니다.
        </p>
      </div>

      <Card className="border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20 mb-5">
        <CardContent className="p-3.5 flex gap-3">
          <Info className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <div className="text-xs text-green-700/80 dark:text-green-300/70 space-y-1">
            <p>
              <span className="font-semibold text-green-700 dark:text-green-300">trace_policy</span> 도구는
              입력한 키워드가 포함된 보도자료를 <strong>날짜 오름차순</strong>으로 정렬해 반환합니다.
            </p>
            <p>
              정책의 초기 발표 → 구체화 → 변화 흐름을 한눈에 파악하거나,
              특정 사안(예: 의대 정원, 반도체 특별법)의 시기별 입장 변화를 분석할 때 유용합니다.
            </p>
            <p className="font-medium text-green-700 dark:text-green-300">
              날짜 범위를 지정하면 특정 기간의 변화만 집중적으로 확인할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleTrace} className="space-y-3 mb-5">
        <div>
          <Label className="text-xs mb-1 block">정책 키워드</Label>
          <div className="flex gap-3">
            <Input
              data-testid="input-trace-keyword"
              placeholder="예: 디지털플랫폼정부, AI 인재양성, 기후위기"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-10"
            />
            <Button
              type="submit"
              className="h-10 px-5"
              disabled={tracePolicy.isPending || !keyword.trim()}
              data-testid="button-trace-submit"
            >
              {tracePolicy.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitCommit className="h-4 w-4" />
              )}
              <span className="ml-1.5">추적</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TRACE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setKeyword(ex)}
              className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors"
              data-testid={`button-trace-example-${ex}`}
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">시작 날짜 (선택)</Label>
            <Input
              data-testid="input-trace-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">종료 날짜 (선택)</Label>
            <Input
              data-testid="input-trace-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </form>

      {tracePolicy.isPending && (
        <div className="py-14 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">정책 타임라인을 불러오고 있습니다...</p>
        </div>
      )}

      {!tracePolicy.isPending && tracePolicy.isSuccess && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold" data-testid="text-trace-keyword">
              타임라인: <span className="text-primary">{tracePolicy.data?.keyword}</span>
            </h2>
            <Badge variant="secondary" className="text-xs" data-testid="text-trace-count">
              {timeline.length}건
            </Badge>
          </div>

          {tracePolicy.data?.fallback && (
            <div className="mb-4 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
              정책 흐름 추적 서버가 일시적으로 점검 중입니다. 키워드 검색 결과로 대체 표시합니다.
            </div>
          )}

          {timeline.length === 0 ? (
            <div className="py-14 text-center border border-dashed rounded-lg">
              <GitCommit className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">해당 키워드의 정책 타임라인을 찾지 못했습니다.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
              <div className="space-y-4">
                {timeline.map((item, i) => (
                  <div
                    key={item.id || i}
                    className="relative pl-7"
                    data-testid={`card-timeline-${i}`}
                  >
                    <div className="absolute left-0 top-2.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium leading-tight text-sm flex-1">{item.title}</h3>
                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                              title="원문 보기"
                              data-testid={`link-source-${i}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {item.date && (
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              {item.date}
                            </div>
                          )}
                          {item.department && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {item.department}
                            </div>
                          )}
                        </div>
                        {item.summary && (
                          <p className="text-xs text-foreground/70 line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
