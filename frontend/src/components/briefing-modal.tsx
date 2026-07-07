import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Building2, Loader2, AlertCircle, FileText } from "lucide-react";

type BriefingData = {
  news_item_id?: string;
  title?: string;
  subject?: string;
  department?: string;
  ministry?: string;
  approve_date?: string;
  date?: string;
  content?: string;
  full_text?: string;
  body?: string;
  summary?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  briefingId: string;
  title: string;
  department?: string;
  date?: string;
};

export function BriefingModal({ open, onClose, briefingId, title, department, date }: Props) {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !briefingId) return;
    let cancelled = false;

    async function fetchBriefing() {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(`/api/chat/briefing/${encodeURIComponent(briefingId)}?max_chars=8000`);
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as BriefingData;
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message || "원문을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBriefing();
    return () => { cancelled = true; };
  }, [open, briefingId]);

  const fullText = data?.content || data?.full_text || data?.body || data?.summary || "";
  const resolvedTitle = data?.title || data?.subject || title;
  const resolvedDept = data?.department || data?.ministry || department;
  const resolvedDate = (data?.approve_date || data?.date || date || "").slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-semibold leading-snug pr-6">
            {resolvedTitle}
          </DialogTitle>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {resolvedDept && (
              <Badge variant="secondary" className="text-xs font-normal flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {resolvedDept}
              </Badge>
            )}
            {resolvedDate && (
              <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {resolvedDate}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-mono font-normal text-muted-foreground">
              ID: {briefingId}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">원문을 불러오는 중...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 py-8 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">원문 조회 실패</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && fullText && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-sans">
                {fullText}
              </div>
            </div>
          )}

          {!loading && !error && !fullText && data && (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">원문 텍스트가 없습니다.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
