import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Building2, ExternalLink } from "lucide-react";
import { BriefingModal } from "./briefing-modal";

type SearchResult = {
  id: string;
  title: string;
  department?: string;
  date?: string;
  summary?: string;
  score?: number;
};

export function SearchResultCard({ result }: { result: SearchResult }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-150 overflow-hidden group"
      >
        <div className="px-3.5 py-3 border-b bg-muted/20 group-hover:bg-muted/40 transition-colors">
          <div className="flex justify-between items-start gap-2">
            <p className="text-sm font-semibold leading-snug flex-1 line-clamp-2 group-hover:text-primary transition-colors">
              {result.title}
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 mt-0.5 transition-colors" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
            {result.date && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {result.date}
              </div>
            )}
            {result.department && (
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {result.department}
              </div>
            )}
            {result.score && result.score > 0 && (
              <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 h-4 bg-background border">
                {result.score.toFixed(2)}
              </Badge>
            )}
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">
            {result.summary || "요약 정보가 없습니다."}
          </p>
          <p className="text-[10px] text-primary/60 mt-1.5 font-medium">클릭하여 원문 보기</p>
        </div>
      </button>

      <BriefingModal
        open={open}
        onClose={() => setOpen(false)}
        briefingId={result.id}
        title={result.title}
        department={result.department}
        date={result.date}
      />
    </>
  );
}
