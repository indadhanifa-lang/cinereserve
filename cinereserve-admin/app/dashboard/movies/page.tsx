"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImagePlus, LayoutGrid, List, Loader2, Search } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

type Movie = {
  id: number;
  title: string;
  poster_url: string | null;
  duration_minutes: number;
  release_date: string | null;
  age_rating: string | null;
  status: string;
  genres: string[];
};

type StatusFilter = "all" | "active" | "inactive";
type SortOption = "release-desc" | "title-asc";
type ViewMode = "table" | "grid";

/** localStorage key for the remembered view toggle. Stored values are
 * "card" | "table"; internal state uses "grid" for the card view. */
const VIEW_STORAGE_KEY = "cinereserve_movies_view";

const readStoredView = (): ViewMode | null => {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === "card") return "grid";
    if (raw === "table") return "table";
    return null;
  } catch {
    return null;
  }
};

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("release-desc");
  const [view, setView] = useState<ViewMode>("table");

  /** Client-only restore: runs after mount, so server render always uses
   * the default view and no hydration mismatch can occur. */
  useEffect(() => {
    const stored = readStoredView();
    if (stored) setView(stored);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(
        VIEW_STORAGE_KEY,
        next === "grid" ? "card" : "table"
      );
    } catch {
      /* storage unavailable — view still changes for this session */
    }
  };

  useEffect(() => {
    fetch("/api/admin/movies")
      .then((res) => res.json())
      .then((data) => setMovies(data.movies ?? []))
      .catch(() => setError("Unable to load movies. Try again."));
  }, []);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const movie of movies ?? []) {
      for (const genre of movie.genres) set.add(genre);
    }
    return [...set].sort();
  }, [movies]);

  const activeCount = useMemo(
    () => (movies ?? []).filter((m) => m.status === "active").length,
    [movies]
  );

  const visibleMovies = useMemo(() => {
    if (!movies) return [];
    const query = search.trim().toLowerCase();

    const filtered = movies.filter((movie) => {
      if (statusFilter !== "all" && movie.status !== statusFilter) return false;
      if (genreFilter && !movie.genres.includes(genreFilter)) return false;
      if (query && !movie.title.toLowerCase().includes(query)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "title-asc") return a.title.localeCompare(b.title);
      return (b.release_date ?? "").localeCompare(a.release_date ?? "");
    });
  }, [movies, search, statusFilter, genreFilter, sort]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (movies === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading movies…</span>
      </div>
    );
  }

  if (movies.length === 0) {
    return <EmptyState {...EMPTY_STATES.movies} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {activeCount} Active Title{activeCount === 1 ? "" : "s"}
        </span>
        <Link
          href="/dashboard/movies/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <ImagePlus className="h-4 w-4" />
          Add Movie
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/30 bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {(["all", "active", "inactive"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors",
                  statusFilter === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {value === "all" ? `All (${movies.length})` : value}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => changeView("grid")}
              aria-label="Grid view"
              title="Grid view"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                view === "grid"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("table")}
              aria-label="Table view"
              title="Table view"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                view === "table"
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <div className="relative flex items-center sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm text-foreground shadow-inner outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-3"
          >
            <option value="">All Genres</option>
            {allGenres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-3"
          >
            <option value="release-desc">Sort: Release Date (Newest)</option>
            <option value="title-asc">Sort: Title (A–Z)</option>
          </select>
        </div>
      </div>

      {visibleMovies.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card p-10 text-center text-sm text-muted-foreground">
          No movies match these filters.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleMovies.map((movie) => (
            <div
              key={movie.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-card shadow-md"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                {movie.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={movie.poster_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize backdrop-blur-md",
                    movie.status === "active"
                      ? "bg-emerald-400/20 text-emerald-400"
                      : "bg-card/80 text-muted-foreground"
                  )}
                >
                  {movie.status}
                </span>
                {movie.age_rating && (
                  <span className="absolute top-2 right-2 rounded-md bg-card/80 px-1.5 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur-md">
                    {movie.age_rating}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="truncate text-sm font-semibold text-foreground" title={movie.title}>
                  {movie.title}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {movie.genres.join(", ") || "—"}
                </p>
                <div className="mt-auto flex items-center justify-between pt-1.5 text-xs text-muted-foreground">
                  <span>{movie.duration_minutes} min</span>
                  <span>{movie.release_date ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Movie</th>
                <th className="px-4 py-3 font-medium">Genres</th>
                <th className="px-4 py-3 font-medium">Release</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visibleMovies.map((movie) => (
                <tr key={movie.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/30 bg-muted">
                        {movie.poster_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={movie.poster_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-foreground">
                          {movie.title}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {movie.age_rating && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                              {movie.age_rating}
                            </span>
                          )}
                          <span>{movie.duration_minutes} min</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {movie.genres.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {movie.release_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                        movie.status === "active"
                          ? "bg-emerald-400/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {movie.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
