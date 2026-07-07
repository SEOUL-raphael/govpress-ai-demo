import { useGetGovpressStats } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Database, Search, Calendar, CheckCircle, GitCommit, Shuffle, List, BookOpen, GitFork } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="shadow-sm" data-testid={`card-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span className={`p-1.5 rounded-md ${color}`}>
            <Icon className="h-4 w-4 text-white" />
          </span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight" data-testid={`value-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
          {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const MCP_TOOLS = [
  {
    name: "search_briefing",
    icon: Search,
    color: "bg-blue-500",
    badge: "의미 검색",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    desc: "BGE-M3 임베딩 + Qdrant 벡터 DB로 의미적으로 유사한 보도자료를 검색합니다. 자연어 질의에 최적화되어 있습니다.",
    params: "query, limit, department, date_from, date_to",
  },
  {
    name: "fts_search",
    icon: FileText,
    color: "bg-orange-500",
    badge: "키워드 검색",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    desc: "SQLite FTS5 전문 검색 엔진으로 본문에서 정확한 단어를 찾습니다. snippet에 하이라이트 포함. 특정 고유명사 검색에 유용합니다.",
    params: "query, limit",
  },
  {
    name: "trace_policy",
    icon: GitCommit,
    color: "bg-green-500",
    badge: "정책 흐름",
    badgeColor: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    desc: "키워드가 포함된 보도자료를 날짜 오름차순으로 정렬해 정책의 시계열 흐름을 시각화합니다. 정책 변화·전환점 분석에 최적화.",
    params: "keyword, date_from, date_to",
  },
  {
    name: "cross_check_ministries",
    icon: Shuffle,
    color: "bg-violet-500",
    badge: "부처 비교",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    desc: "주제에 대해 여러 부처가 발표한 내용을 교차 비교합니다. 부처별 목표·수치·표현의 차이를 찾는 데 사용합니다.",
    params: "topic, min_ministries",
  },
  {
    name: "list_briefings",
    icon: List,
    color: "bg-slate-500",
    badge: "목록 조회",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    desc: "최신 보도자료를 페이지 단위로 목록 조회합니다. 부처명 필터를 적용해 특정 부처의 최신 발표만 볼 수 있습니다.",
    params: "department, page, page_size",
  },
  {
    name: "get_briefing",
    icon: BookOpen,
    color: "bg-cyan-500",
    badge: "단건 조회",
    badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    desc: "보도자료 ID로 특정 문서의 전문을 가져옵니다. max_chars로 반환 길이를 조절할 수 있습니다.",
    params: "id, max_chars",
  },
  {
    name: "get_stats",
    icon: GitFork,
    color: "bg-teal-500",
    badge: "통계",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    desc: "GovPress 데이터베이스의 전체 통계를 반환합니다. 총 문서 수, 벡터 색인 수, 최근 업데이트 일자 등을 확인합니다.",
    params: "(없음)",
  },
];

export default function StatsPage() {
  const { data: stats, isLoading, isError } = useGetGovpressStats();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6">
        <div className="py-20 text-center border border-dashed rounded-lg">
          <p className="text-destructive">통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Database className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Corpus 통계</h1>
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-[1.85rem]">
          GovPress MCP 서버 실시간 현황 및 도구 사용 안내
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          icon={FileText}
          label="전체 문서"
          value={stats?.doc_count ?? 0}
          sub="정책브리핑 보도자료"
          color="bg-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          label="색인 완료"
          value={stats?.indexed_count ?? 0}
          sub="벡터 임베딩 생성 완료"
          color="bg-green-500"
        />
        <StatCard
          icon={Database}
          label="벡터 청크"
          value={stats?.chunk_count ?? 0}
          sub="Qdrant + FTS5 색인"
          color="bg-violet-500"
        />
        <StatCard
          icon={Calendar}
          label="최근 업데이트"
          value={stats?.last_updated ? stats.last_updated.slice(0, 10) : "-"}
          sub="가장 최근 보도자료 날짜"
          color="bg-orange-500"
        />
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          MCP 도구 안내 (7개)
        </h2>
        <div className="space-y-2">
          {MCP_TOOLS.map((tool) => (
            <Card key={tool.name} className="shadow-sm border-border/60" data-testid={`card-tool-${tool.name}`}>
              <CardContent className="p-3.5 flex gap-3 items-start">
                <div className={`p-1.5 rounded-md shrink-0 mt-0.5 ${tool.color}`}>
                  <tool.icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <code className="text-sm font-semibold font-mono">{tool.name}</code>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tool.badgeColor}`}>
                      {tool.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-1">{tool.desc}</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    <span className="font-medium">파라미터:</span> {tool.params}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">GovPress 데이터 정보</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>수집 기간: 2021-04 ~ 현재 (정기 업데이트)</li>
            <li>변환: HWPX / PDF → Markdown (원문 보존)</li>
            <li>의미 검색: BGE-M3 임베딩 + Qdrant 벡터 DB</li>
            <li>키워드 검색: SQLite FTS5 전문 검색 엔진</li>
            <li>MCP 엔드포인트: <code className="bg-muted px-1 rounded">https://mcp.govpress.cloud/mcp</code></li>
          </ul>
          <p className="text-[11px] text-muted-foreground/60 pt-1 border-t">
            데이터 출처: 공공데이터포털 정책브리핑 API | 라이선스: 공공누리 1유형 (출처표시)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
