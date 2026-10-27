"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Clapperboard,
  Drama,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { cn } from "@/lib/utils";
import { HREF_BY_ID, META, NAV_GROUPS, SETTINGS_ICON, type ModuleId } from "@/lib/dashboard-nav";

function activeIdFor(pathname: string): ModuleId {
  const entries = Object.entries(HREF_BY_ID) as [ModuleId, string][];
  const exact = entries.find(([, href]) => href === pathname);
  if (exact) return exact[0];

  const prefix = entries.find(([, href]) => href !== "/dashboard" && pathname.startsWith(href + "/"));
  return prefix ? prefix[0] : "dashboard";
}

type Branch = {
  id: number;
  name: string;
  city: string | null;
  province: string | null;
  logo_url: string | null;
  status: string;
};

type Organization = { id: number; name: string };

type AdminUser = {
  name: string;
  avatar_url: string | null;
  role: string;
  branch: Branch | null;
  organization: Organization | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

type AdminNotification = {
  id: number;
  type: string;
  title: string;
  message: string;
  data: { reservation_code?: string; [key: string]: unknown } | null;
  read_at: string | null;
  created_at: string | null;
};

/** "Just now", "5 min ago", "3 hr ago", … — derived from created_at. */
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString();
}

function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  className: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn(className, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  const initials = getInitials(name);
  return (
    <div
      className={cn(
        className,
        "flex shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-secondary-foreground"
      )}
    >
      {initials}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeId = activeIdFor(pathname);
  const meta = META[activeId];
  const [user, setUser] = useState<AdminUser | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close the mobile nav after navigating (state adjusted during render).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  useEffect(() => {
    const loadUser = () => {
      fetch("/api/admin/me")
        .then((res) => res.json())
        .then((data) =>
          setUser(
            data.user
              ? {
                  name: data.user.name,
                  avatar_url: data.user.avatar_url,
                  role: data.user.role,
                  branch: data.user.branch ?? null,
                  organization: data.user.organization ?? null,
                }
              : null
          )
        )
        .catch(() => {});
    };
    loadUser();
    window.addEventListener("admin-profile-updated", loadUser);
    return () => window.removeEventListener("admin-profile-updated", loadUser);
  }, []);

  // ── Admin notifications (branch-scoped, read-only polling) ─────────
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifError, setNotifError] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);

  // One fetch used by every trigger. Failures never log the admin out,
  // never clear previously loaded notifications — they only flag the
  // subtle error hint; the next poll retries normally.
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error("notifications fetch failed");
      const data = await res.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unread_count === "number" ? data.unread_count : 0);
      setNotifError(false);
    } catch {
      setNotifError(true);
    }
  }, []);

  // Single polling lifecycle: initial load + 30s interval + window focus
  // + visibility return, all registered once and fully cleaned up on
  // unmount (no duplicate intervals or listeners). Polling only READS —
  // it never creates notifications.
  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      if (!cancelled) void loadNotifications();
    };

    refresh();
    const intervalId = window.setInterval(refresh, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadNotifications]);

  // Close the dropdown on Escape or outside click.
  useEffect(() => {
    if (!notifOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [notifOpen]);

  const displayName = user?.name ?? "";
  const displayRole = user?.role
    ? user.role
        .split(/[\s_-]+/)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ")
    : "";

  const branch = user?.branch ?? null;
  const branchCode = branch ? `#BR-${String(branch.id).padStart(4, "0")}` : "";

  // Optimistic read of one notification — unreadCount is decremented
  // only when the item was actually unread and never goes below zero —
  // then navigate to Reservations. Server PATCH is idempotent; on
  // failure an immediate refetch restores the authoritative state.
  const handleNotificationClick = async (item: AdminNotification) => {
    setNotifOpen(false);

    if (!item.read_at) {
      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: nowIso } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        const res = await fetch(`/api/admin/notifications/${item.id}/read`, {
          method: "PATCH",
        });
        if (!res.ok) throw new Error("mark-read failed");
      } catch {
        setNotifError(true);
      }
      void loadNotifications();
    }

    router.push("/dashboard/reservations");
  };

  // Mark the whole branch read (server updates ALL unread rows, not just
  // the loaded 50), then refetch for authoritative synchronization.
  const handleMarkAllRead = async () => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso }))
    );
    setUnreadCount(0);
    try {
      const res = await fetch("/api/admin/notifications/read-all", {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("mark-all-read failed");
    } catch {
      setNotifError(true);
    }
    void loadNotifications();
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile drawer backdrop */}
      <div
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed top-0 left-0 z-50 flex h-dvh w-64 max-w-[85vw] flex-col justify-between bg-[#0e0e12] px-4 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform duration-200 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="scrollbar-hide flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="relative flex items-center gap-3 border-b border-border/20 pr-8 pb-3 pl-1 lg:pr-1">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
              className="absolute top-0 right-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/20 text-primary shadow-[0_0_12px_rgba(124,58,237,0.25)]">
              <Clapperboard className="h-[22px] w-[22px]" />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-foreground">
                  CineReserve
                </span>
                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold text-primary-foreground">
                  AI
                </span>
              </div>
              {user?.organization && (
                <span className="mt-0.5 truncate text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  {user.organization.name}
                </span>
              )}
            </div>
          </div>

          {branch && (
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/80 p-2 shadow-sm">
              <div className="relative shrink-0">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-muted text-primary">
                  {branch.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branch.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Drama className="h-[18px] w-[18px]" />
                  )}
                </div>
                <span
                  title={branch.status}
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0e0e12]",
                    branch.status === "active"
                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                      : "bg-muted-foreground"
                  )}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className="truncate text-[13px] leading-snug font-medium tracking-tight text-foreground"
                  title={branch.name}
                >
                  {branch.name}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  Branch ID {branchCode}
                </span>
              </div>
            </div>
          )}

          <nav className="flex flex-col">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-1 pt-2.5 pb-1">
                  <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.label}
                  </span>
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeId === item.id;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-all",
                        active
                          ? "bg-primary font-semibold text-primary-foreground shadow-[0_0_14px_rgba(124,58,237,0.35)]"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-card p-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={displayName} avatarUrl={user?.avatar_url ?? null} className="h-8 w-8" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{displayRole}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                href={HREF_BY_ID.settings}
                title="Settings"
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  activeId === "settings"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <SETTINGS_ICON className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center justify-between gap-3 bg-background/80 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-6 lg:left-64">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="dashboard-sidebar"
            className="-ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
          >
            <span className="hidden cursor-pointer transition-colors hover:text-foreground sm:inline">
              Admin Portal
            </span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-border sm:block" />
            <span className="truncate font-semibold text-foreground">{meta.title}</span>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <GlobalSearch />
          <div ref={bellRef} className="relative">
            <button
              type="button"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((open) => !open)}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/30 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground ring-2 ring-background">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute top-11 right-0 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/30 bg-card shadow-xl">
                <div className="flex items-center justify-between gap-2 border-b border-border/20 px-3 py-2">
                  <span className="text-sm font-semibold text-foreground">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all as read
                    </button>
                  )}
                </div>

                {notifError && (
                  <p className="border-b border-border/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                    Couldn&apos;t refresh notifications.
                  </p>
                )}

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm font-medium text-foreground">
                        No notifications yet
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        New customer reservations and confirmed bookings will
                        appear here.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/20">
                      {notifications.map((item) => {
                        const unread = !item.read_at;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(item)}
                              className={cn(
                                "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                                unread
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : "hover:bg-accent"
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                  unread
                                    ? "bg-primary"
                                    : "invisible bg-transparent"
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      "truncate text-xs",
                                      unread
                                        ? "font-semibold text-foreground"
                                        : "font-medium text-muted-foreground"
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {formatRelativeTime(item.created_at)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {item.message}
                                </span>
                                {item.data?.reservation_code && (
                                  <span className="mt-0.5 block text-[10px] font-medium text-primary">
                                    {item.data.reservation_code}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:border-l sm:border-border/30 sm:pl-3">
            <Avatar name={displayName} avatarUrl={user?.avatar_url ?? null} className="h-8 w-8" />
            <div className="hidden flex-col text-left leading-none lg:flex">
              <span className="font-medium text-foreground">{displayName}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">{displayRole}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="min-h-screen w-full bg-background px-4 pt-16 sm:px-6 lg:pl-[calc(16rem+1.5rem)]">
        <div className="flex w-full min-w-0 flex-col pt-6 pb-16">
          <div className="mb-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {meta.title}
              </span>
              {branch && (
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {branch.name}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
          </div>

          <Suspense>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
