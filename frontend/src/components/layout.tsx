import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart2,
  Search,
  MessageSquare,
  GitCommit,
  ShieldCheck,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { useHealthCheck } from "@/hooks/use-api";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/", label: "AI 정책 분석", icon: MessageSquare },
  { href: "/search", label: "보도자료 검색", icon: Search },
  { href: "/trace", label: "정책 흐름 추적", icon: GitCommit },
  { href: "/stats", label: "Corpus 통계", icon: BarChart2 },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            GovPress AI
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">한국 정책 정보 검색</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors md:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="px-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t">
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">기반 기술</p>
          <a
            href="https://github.com/wavelen-jw/GovPress-MCP"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between group px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-slate-700 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 16 16" className="h-3 w-3 fill-white" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">GovPress MCP</p>
                <p className="text-[10px] text-muted-foreground">130,012 정책 브리핑</p>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </a>
          <a
            href="https://www.minimax.io/models/text/m27"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between group px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-violet-600 flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-white">M</span>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">MiniMax M2.7</p>
                <p className="text-[10px] text-muted-foreground">AI 분석 모델</p>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </a>
        </div>
        <div className="px-4 py-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">서버 상태</span>
            {health?.status === "ok" ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-transparent shadow-none font-normal text-[10px] py-0 px-1.5">온라인</Badge>
            ) : (
              <Badge variant="destructive" className="font-normal text-[10px] py-0 px-1.5 shadow-none border-transparent">오프라인</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r bg-card flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay + drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r shadow-xl flex flex-col">
            <SidebarContent onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between px-4 h-12 border-b bg-card shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-bold text-base tracking-tight">GovPress AI</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-card/95 backdrop-blur-sm z-40 flex items-stretch">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span className="text-[9px] font-medium leading-tight text-center px-0.5">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
