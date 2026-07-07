import { useState } from "react";
import {
  useSearchGovpress,
  useFtsSearchGovpress,
  useListBriefings,
} from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchResultCard } from "@/components/search-result-card";
import {
  Loader2,
  Search,
  Sparkles,
  FileText,
  Info,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SearchMode = "semantic" | "fts" | "dept";

const FORMAT_LABEL: Record<string, string> = {
  hwpx: "HWP",
  hwp: "HWP",
  pdf: "PDF",
  docx: "Word",
};

type LastSearchType = "semantic" | "fts" | "list" | "dept" | null;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [ministry, setMinistry] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mode, setMode] = useState<SearchMode>("semantic");

  const [deptQuery, setDeptQuery] = useState("");
  const [deptDateFrom, setDeptDateFrom] = useState("");
  const [deptDateTo, setDeptDateTo] = useState("");
  const [deptPage, setDeptPage] = useState(1);
  const PAGE_SIZE = 20;

  // Tracks what was actually executed last (not the current input state)
  const [lastSearchType, setLastSearchType] = useState<LastSearchType>(null);

  const semanticSearch = useSearchGovpress();
  const ftsSearch = useFtsSearchGovpress();
  const listSearch = useListBriefings();

  const isPending =
    lastSearchType === "dept" || lastSearchType === "list"
      ? listSearch.isPending
      : lastSearchType === "semantic"
        ? semanticSearch.isPending
        : lastSearchType === "fts"
          ? ftsSearch.isPending
          : false;

  const results =
    lastSearchType === "semantic"
      ? (semanticSearch.data?.results ?? [])
      : lastSearchType === "fts"
        ? (ftsSearch.data?.results ?? [])
        : [];

  const total =
    lastSearchType === "semantic"
      ? (semanticSearch.data?.total ?? 0)
      : lastSearchType === "fts"
        ? (ftsSearch.data?.total ?? 0)
        : 0;

  const listItems = listSearch.data?.items ?? [];
  const listTotal = listSearch.data?.total ?? 0;
  const listHasMore = listSearch.data?.has_more ?? false;

  const canSearch =
    mode === "dept"
      ? !!(deptQuery.trim() || deptDateFrom || deptDateTo)
      : !!(query.trim() || ministry.trim() || dateFrom || dateTo);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSearch) return;

    if (mode === "dept") {
      setDeptPage(1);
      setLastSearchType("dept");
      listSearch.mutate({
        data: {
          department: deptQuery.trim() || undefined,
          date_from: deptDateFrom || undefined,
          date_to: deptDateTo || undefined,
          page: 1,
          page_size: PAGE_SIZE,
        },
      });
      return;
    }

    const hasQuery = !!query.trim();
    const hasFilter = !!(ministry.trim() || dateFrom || dateTo);

    if (!hasQuery && hasFilter) {
      setLastSearchType("list");
      listSearch.mutate({
        data: {
          department: ministry.trim() || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          page: 1,
          page_size: PAGE_SIZE,
        },
      });
      return;
    }

    if (mode === "semantic") {
      setLastSearchType("semantic");
      semanticSearch.mutate({
        data: {
          query,
          limit: 50,
          ministry: ministry || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
    } else {
      setLastSearchType("fts");
      ftsSearch.mutate({ data: { query, limit: 50 } });
    }
  };

  const handleDeptPageChange = (newPage: number) => {
    setDeptPage(newPage);
    listSearch.mutate({
      data: {
        department: deptQuery.trim() || undefined,
        date_from: deptDateFrom || undefined,
        date_to: deptDateTo || undefined,
        page: newPage,
        page_size: PAGE_SIZE,
      },
    });
  };

  const isListMode = lastSearchType === "list" || lastSearchType === "dept";

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">보도자료 검색</h1>
        </div>
        <p className="text-xs text-muted-foreground pl-[1.85rem]">
          130,000여 건의 정부 보도자료를 세 가지 방식으로 검색합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 sm:mb-5">
        <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-3.5 flex gap-3">
            <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">의미 검색</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-300/70">
                자연어로 의미 기반 검색. 부처명·날짜만 입력하면 목록 조회.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/20">
          <CardContent className="p-3.5 flex gap-3">
            <FileText className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-0.5">키워드 검색</p>
              <p className="text-xs text-orange-600/80 dark:text-orange-300/70">
                본문에서 정확한 단어를 FTS로 검색합니다.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20">
          <CardContent className="p-3.5 flex gap-3">
            <Building2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-0.5">부서별 검색</p>
              <p className="text-xs text-green-600/80 dark:text-green-300/70">
                부처명·날짜 조건으로 목록을 페이지별 조회합니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSearch} className="space-y-3 mb-6">
        <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
          <TabsList>
            <TabsTrigger value="semantic" data-testid="tab-semantic">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              의미 검색
            </TabsTrigger>
            <TabsTrigger value="fts" data-testid="tab-fts">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              키워드 검색
            </TabsTrigger>
            <TabsTrigger value="dept" data-testid="tab-dept">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              부서별 검색
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode !== "dept" && (
          <div className="flex gap-3">
            <Input
              data-testid="input-search-query"
              placeholder={
                mode === "semantic"
                  ? "예: 디지털플랫폼정부 추진 계획 (공란 시 부처/날짜로 목록 조회)"
                  : "예: 탄소중립"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10"
            />
            <Button
              type="submit"
              className="h-10 px-5"
              disabled={isPending || !canSearch}
              data-testid="button-search-submit"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-1.5">검색</span>
            </Button>
          </div>
        )}

        {mode === "semantic" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-xs">부처명 (선택)</Label>
              <Input
                data-testid="input-ministry"
                placeholder="예: 행정안전부"
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">시작 날짜</Label>
              <Input
                data-testid="input-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">종료 날짜</Label>
              <Input
                data-testid="input-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}

        {mode === "fts" && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>키워드 검색은 본문에서 정확한 단어를 찾습니다.</span>
          </div>
        )}

        {mode === "dept" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-1">
                <Label className="text-xs">부처명</Label>
                <Input
                  data-testid="input-dept-query"
                  placeholder="예: 과학기술정보통신부"
                  value={deptQuery}
                  onChange={(e) => setDeptQuery(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">시작 날짜</Label>
                <Input
                  data-testid="input-dept-date-from"
                  type="date"
                  value={deptDateFrom}
                  onChange={(e) => setDeptDateFrom(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">종료 날짜</Label>
                <Input
                  data-testid="input-dept-date-to"
                  type="date"
                  value={deptDateTo}
                  onChange={(e) => setDeptDateTo(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="h-10 px-5"
              disabled={isPending || !canSearch}
              data-testid="button-dept-search-submit"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              <span className="ml-1.5">부서별 조회</span>
            </Button>
          </div>
        )}
      </form>

      {isPending && (
        <div className="py-14 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">보도자료를 검색하고 있습니다...</p>
        </div>
      )}

      {!isPending && (isListMode ? listItems.length > 0 : results.length > 0) && (
        <div>
          {lastSearchType === "dept" ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground" data-testid="text-result-count">
                  총 <span className="font-semibold text-foreground">{listTotal.toLocaleString()}</span>건 ·{" "}
                  {deptPage}페이지
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={deptPage <= 1}
                    onClick={() => handleDeptPageChange(deptPage - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{deptPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={!listHasMore}
                    onClick={() => handleDeptPageChange(deptPage + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {listItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.department && (
                          <span className="text-xs text-muted-foreground">{item.department}</span>
                        )}
                        {item.date && (
                          <span className="text-xs text-muted-foreground">{item.date.slice(0, 10)}</span>
                        )}
                        {item.source_format && FORMAT_LABEL[item.source_format] && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {FORMAT_LABEL[item.source_format]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                        title="원문 보기"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {listHasMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeptPageChange(deptPage + 1)}
                    disabled={isPending}
                  >
                    다음 페이지
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : isListMode ? (
            <>
              <p className="text-xs text-muted-foreground mb-4" data-testid="text-result-count">
                <span className="font-semibold text-foreground">{listSearch.data?.total?.toLocaleString()}</span>건 발견 (목록 조회)
              </p>
              <div className="space-y-2">
                {(listSearch.data?.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.department && (
                          <span className="text-xs text-muted-foreground">{item.department}</span>
                        )}
                        {item.date && (
                          <span className="text-xs text-muted-foreground">{item.date.slice(0, 10)}</span>
                        )}
                        {item.source_format && FORMAT_LABEL[item.source_format] && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {FORMAT_LABEL[item.source_format]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0 mt-0.5"
                        title="원문 보기"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4" data-testid="text-result-count">
                <span className="font-semibold text-foreground">{total}</span>건 발견
              </p>
              <div className="space-y-3">
                {results.map((r, i) => (
                  <div key={r.id} data-testid={`card-result-${i}`}>
                    <SearchResultCard result={r} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!isPending &&
        lastSearchType !== null &&
        (isListMode
          ? listSearch.isSuccess && listItems.length === 0
          : (semanticSearch.isSuccess || ftsSearch.isSuccess) && results.length === 0) && (
          <div className="py-14 text-center border border-dashed rounded-lg">
            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">결과를 찾지 못했습니다. 다른 조건을 시도해보세요.</p>
          </div>
        )}
    </div>
  );
}
