"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResult = {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  href: string;
};

const GROUPS: { label: string; type: string }[] = [
  { label: "Movies", type: "movie" },
  { label: "Screens", type: "screen" },
  { label: "Schedules", type: "schedule" },
  { label: "Reservations", type: "reservation" },
  { label: "Customers", type: "customer" },
  { label: "Payments", type: "payment" },
  { label: "Tickets", type: "ticket" },
];

/** True when the event target is a text-entry surface — the "/" shortcut
 * must never steal focus while the admin is typing elsewhere. */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
};

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(-1);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: results.filter((result) => result.type === group.type),
      })).filter((group) => group.items.length > 0),
    [results]
  );
  const flat = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);

  // "/" focuses the global search from anywhere, except while typing in
  // another input/textarea/select/contenteditable field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close when clicking outside the search block.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Close after navigating to another page (state adjusted during render).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
    setHighlighted(-1);
  }

  const changeQuery = (value: string) => {
    setQuery(value);
    setHighlighted(-1);
    setFailed(false);

    if (value.trim().length < 2) {
      requestSeq.current += 1;
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(true);
  };

  // Debounced fetch: 280ms, stale responses ignored via request id.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timer = window.setTimeout(async () => {
      const seq = ++requestSeq.current;
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json().catch(() => ({}));
        if (seq !== requestSeq.current) return;
        if (!res.ok) throw new Error(data.message);
        setResults(Array.isArray(data.results) ? data.results : []);
        setHighlighted(-1);
      } catch {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query]);

  const navigate = (result: SearchResult) => {
    changeQuery("");
    router.push(`${result.href}?q=${encodeURIComponent(result.title)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (open) {
        setOpen(false);
      } else {
        inputRef.current?.blur();
      }
      return;
    }

    if (!open || flat.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) => (prev + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) => (prev <= 0 ? flat.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      const target = highlighted >= 0 ? flat[highlighted] : null;
      if (target) {
        e.preventDefault();
        navigate(target);
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative hidden items-center md:flex">
      <Search className="pointer-events-none absolute left-2.5 h-[18px] w-[18px] text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => changeQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search screens, bookings, movies..."
        className="h-9 w-44 rounded-lg border border-border/30 bg-card pr-8 pl-9 text-sm text-foreground placeholder-muted-foreground shadow-inner transition-all focus:border-primary/40 focus:bg-accent focus:outline-none lg:w-64"
      />
      <kbd className="absolute right-2.5 rounded border border-border/30 bg-[#353439] px-1.5 py-0.5 text-[10px] text-muted-foreground">
        /
      </kbd>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border/30 bg-card shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching…</span>
            </div>
          ) : failed ? (
            <div className="px-3 py-4 text-[11px] text-muted-foreground">
              Search unavailable.
            </div>
          ) : flat.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-muted-foreground">
              No results found.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {grouped.map((group) => (
                <div key={group.type}>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const index = flat.indexOf(item);
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setHighlighted(index)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                          highlighted === index ? "bg-accent" : "hover:bg-accent"
                        )}
                      >
                        <span className="truncate text-sm text-foreground">
                          {item.title}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
