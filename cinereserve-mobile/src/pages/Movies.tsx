import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { useSearchParams } from "react-router-dom";
import {
  alertCircleOutline,
  chevronDownOutline,
  closeOutline,
  filmOutline,
  homeOutline,
  locationOutline,
  notificationsOutline,
  personCircleOutline,
  pricetagOutline,
  personOutline,
  receiptOutline,
  searchOutline,
  syncOutline,
  ticketOutline,
} from "ionicons/icons";
import { apiGetAuth, resolveStorageUrl } from "../lib/api";
import { navigate } from "../lib/nav";
import HelpChat from "../components/HelpChat";
import "./Movies.css";

interface UpcomingSchedule {
  id: number;
  show_date: string;
  start_time: string;
  end_time: string;
  ticket_price: string;
  branch: { id: number; name: string } | null;
  screen: { id: number; name: string } | null;
}

interface ShowtimeMovie {
  id: number;
  title: string;
  description: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  duration_minutes: number | null;
  release_date: string | null;
  language: string | null;
  age_rating: string | null;
  genres: string[];
  upcoming_schedules: UpcomingSchedule[];
}

interface ShowtimesResponse {
  movies: ShowtimeMovie[];
}

type FilterId = "all" | "now-showing" | "coming-soon";

/** Today's LOCAL date as YYYY-MM-DD, for direct string comparison with
 * show_date (also YYYY-MM-DD). Never new Date(show_date): that parses as
 * UTC midnight and can shift the day. */
const localTodayString = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object") {
    const apiError = error as { message?: string; errors?: Record<string, string[]> };
    const firstError = apiError.errors ? Object.values(apiError.errors)[0] : undefined;
    if (firstError && firstError[0]) return firstError[0];
    if (apiError.message) return apiError.message;
  }
  return fallback;
};

/** HH:MM:SS (or HH:MM) → "6:00 PM" */
const formatTime = (time: string): string => {
  const [rawHours, minutes] = time.split(":").map(Number);
  const hours = rawHours ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, "0")} ${period}`;
};

/** show_date (YYYY-MM-DD) → "Sep 30, 2026". Date object used only for
 * display formatting, never for date-only comparison. */
const formatDate = (showDate: string): string => {
  const [year, month, day] = showDate.split("-").map(Number);
  if (!year || !month || !day) return showDate;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const MovieFilterIcon: React.FC = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="6" y="10" width="36" height="28" rx="4" />
    <line x1="6" y1="18" x2="42" y2="18" />
    <circle cx="16" cy="28" r="4" />
    <circle cx="32" cy="28" r="4" />
    <path d="M20 28 L28 28" />
  </svg>
);

const Movies: React.FC = () => {
  const ionRouter = useIonRouter();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [activeBranch, setActiveBranch] = useState<number | null>(null);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [movies, setMovies] = useState<ShowtimeMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<ShowtimeMovie | null>(null);
  const [detailsMovie, setDetailsMovie] = useState<ShowtimeMovie | null>(null);
  // Every branch screening the movie, taken from its upcoming showtimes.
  const detailsBranches = [
    ...new Set(
      (detailsMovie?.upcoming_schedules ?? [])
        .map((schedule) => schedule.branch?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];
  const [failedPosterIds, setFailedPosterIds] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastSubtitle, setToastSubtitle] = useState("");

  // Header avatar (decorative) and the name the help chat greets: fetched
  // independently of the movie list; any failure simply keeps the defaults.
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [failedHeaderAvatarUrl, setFailedHeaderAvatarUrl] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);

  const loadHeaderAvatar = useCallback(async () => {
    try {
      const data = await apiGetAuth<{ user: { name: string; avatar_url: string | null } }>(
        "/customer/me"
      );
      setHeaderAvatarUrl(resolveStorageUrl(data.user?.avatar_url));
      setFailedHeaderAvatarUrl(null);
      setCustomerName(data.user?.name ?? null);
    } catch {
      setHeaderAvatarUrl(null);
    }
  }, []);

  // Monotonic id: only the newest request may write state, so a slow
  // earlier response can never overwrite a fresher one.
  const requestRef = useRef(0);
  // The ?movie= param is handled once per view-entry load cycle only — a
  // later Refresh must not reopen a modal the customer just closed, but
  // re-entering the view (Home → Movies again) starts a new cycle.
  const queryHandledForRef = useRef(-1);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  /** After a view-entry load: validate ?movie= and open its showtimes. */
  const openMovieFromQuery = useCallback(
    (movieList: ShowtimeMovie[], requestId: number) => {
      if (queryHandledForRef.current === requestId) return;
      queryHandledForRef.current = requestId;

      const raw = searchParams.get("movie");
      if (!raw) return;
      const movieId = Number(raw);
      if (!Number.isFinite(movieId)) return;

      const match = movieList.find((movie) => movie.id === movieId);
      // Unknown id → normal page, no crash. Param stays in the URL.
      if (!match) return;

      setSearch("");
      setActiveFilter("all");
      setSelectedMovie(match);
    },
    [searchParams]
  );

  const loadMovies = useCallback(
    async (fromViewEntry: boolean) => {
      const requestId = ++requestRef.current;
      if (fromViewEntry) setLoading(true);

      try {
        const data = await apiGetAuth<ShowtimesResponse>("/customer/showtimes");
        if (requestId !== requestRef.current) return;
        const list = data.movies ?? [];
        setMovies(list);
        if (fromViewEntry) openMovieFromQuery(list, requestId);
      } catch (error) {
        if (requestId !== requestRef.current) return;
        showToastMessage(
          "Unable to load movies",
          getErrorMessage(error, "Please try again later.")
        );
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [openMovieFromQuery, showToastMessage]
  );

  // Every entry (first load, Home → Movies, tab returns) refreshes data
  // and re-evaluates the ?movie= parameter.
  useIonViewWillEnter(() => {
    loadMovies(true);
    void loadHeaderAvatar();
  });

  // Manual refresh: reloads only, never re-opens the query modal.
  const handleRefresh = () => {
    if (loading) return;
    loadMovies(false);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const today = localTodayString();

  /** Tab rules (approved): Now Showing = a returned schedule dated today;
   * Coming Soon = no schedule today and the nearest one after today;
   * All Showtimes = everything the API returned. */
  /** Every branch with an upcoming showtime, by name. */
  const branches = useMemo(() => {
    const byId = new Map<number, string>();
    movies.forEach((movie) =>
      movie.upcoming_schedules.forEach((s) => {
        if (s.branch) byId.set(s.branch.id, s.branch.name);
      })
    );
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [movies]);

  // A branch that vanished after a refresh falls back to all branches.
  const branchId = branches.some((b) => b.id === activeBranch) ? activeBranch : null;

  /** Branch filter runs first and trims each movie's showtimes to that
   * branch, so the tabs and the Showtimes sheet only see its schedules. */
  const branchMovies = useMemo(() => {
    if (branchId === null) return movies;
    return movies
      .map((movie) => ({
        ...movie,
        upcoming_schedules: movie.upcoming_schedules.filter((s) => s.branch?.id === branchId),
      }))
      .filter((movie) => movie.upcoming_schedules.length > 0);
  }, [movies, branchId]);

  const tabMovies = useMemo(() => {
    if (activeFilter === "all") return branchMovies;
    return branchMovies.filter((movie) => {
      const hasToday = movie.upcoming_schedules.some((s) => s.show_date === today);
      if (activeFilter === "now-showing") return hasToday;
      // coming-soon: nothing today; schedules arrive chronologically,
      // so the first one is the nearest.
      return !hasToday && (movie.upcoming_schedules[0]?.show_date ?? "") > today;
    });
  }, [branchMovies, activeFilter, today]);

  /** Every genre across the loaded movies, alphabetical. */
  const genres = useMemo(
    () => [...new Set(movies.flatMap((movie) => movie.genres))].sort((a, b) => a.localeCompare(b)),
    [movies]
  );

  // A genre that vanished after a refresh falls back to all genres.
  const genre = activeGenre !== null && genres.includes(activeGenre) ? activeGenre : null;

  /** Genre chip and search applied after the tab filter; search matches
   * title or genre, case-insensitive. */
  const visibleMovies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tabMovies.filter(
      (movie) =>
        (genre === null || movie.genres.includes(genre)) &&
        (!query ||
          movie.title.toLowerCase().includes(query) ||
          movie.genres.some((g) => g.toLowerCase().includes(query)))
    );
  }, [tabMovies, search, genre]);

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: "All Showtimes" },
    { id: "now-showing", label: "Now Showing" },
    { id: "coming-soon", label: "Coming Soon" },
  ];

  return (
    <IonPage>
      <div className="movies-page">
        <header className="movies-header">
          <div className="movies-header__brand">
            <img src="/logo.png" alt="CineReserve AI" className="movies-header__logo" />
          </div>
          <div className="movies-header__actions">
            <button type="button" className="icon-button" aria-label="Notifications">
              <IonIcon icon={notificationsOutline} />
            </button>
            <div className="movies-header__avatar" aria-hidden="true">
              {headerAvatarUrl && headerAvatarUrl !== failedHeaderAvatarUrl ? (
                <img
                  src={headerAvatarUrl}
                  alt=""
                  onError={() => setFailedHeaderAvatarUrl(headerAvatarUrl)}
                />
              ) : (
                <IonIcon icon={personOutline} />
              )}
            </div>
          </div>
        </header>

        <IonContent scrollY className="movies-content">
          <div className="movies-body">
            <div className="movies-search-wrap">
              <div className="movies-search">
                <IonIcon icon={searchOutline} className="movies-search__icon" />
                <input
                  type="text"
                  className="movies-search__input"
                  placeholder="Search titles and genres..."
                  value={search}
                  onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                />
                {search.trim().length > 0 && (
                  <button
                    type="button"
                    className="movies-search__clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <IonIcon icon={closeOutline} />
                  </button>
                )}
              </div>
            </div>

            <div className="movies-pills">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`movies-pill${activeFilter === f.id ? " movies-pill--active" : ""}`}
                  onClick={() => setActiveFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {branches.length > 0 && (
              <div className="movies-pills" role="group" aria-label="Filter by branch">
                {[{ id: null, name: "All Branches" }, ...branches].map((b) => (
                  <button
                    key={b.id ?? "all"}
                    type="button"
                    className={`movies-pill movies-pill--outline${branchId === b.id ? " movies-pill--active" : ""}`}
                    aria-pressed={branchId === b.id}
                    onClick={() => setActiveBranch(b.id)}
                  >
                    {b.id === null && <IonIcon icon={locationOutline} aria-hidden="true" />}
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {genres.length > 0 && (
              // Native select stretched invisibly over the pill: the whole pill opens
              // the phone's own picker, and the list isn't indented by icon padding.
              <label className={`movies-select${genre !== null ? " movies-select--active" : ""}`}>
                <IonIcon icon={pricetagOutline} aria-hidden="true" />
                <span className="movies-select__value">{genre ?? "All Genres"}</span>
                <IonIcon icon={chevronDownOutline} aria-hidden="true" />
                <select
                  aria-label="Filter by genre"
                  value={genre ?? ""}
                  onChange={(e) => setActiveGenre(e.target.value || null)}
                >
                  <option value="">All Genres</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {loading && movies.length === 0 ? (
              <div className="movies-loading" role="status" aria-live="polite">
                <IonSpinner name="dots" />
                <span className="movies-loading__text">Loading movies…</span>
              </div>
            ) : movies.length === 0 ? (
              <div className="movies-empty-card">
                <div className="movies-empty-card__glow" aria-hidden="true" />
                <div className="movies-empty-card__arc" aria-hidden="true" />
                <div className="movies-empty-card__icon-wrap">
                  <div className="movies-empty-card__icon-glow" aria-hidden="true" />
                  <div className="movies-empty-card__icon">
                    <MovieFilterIcon />
                  </div>
                </div>
                <h2 className="movies-empty-card__title">No Movies Available</h2>
                <p className="movies-empty-card__text">
                  Available movies will appear here once cinema schedules are added.
                </p>
                <button
                  type="button"
                  className="movies-refresh-btn"
                  onClick={handleRefresh}
                  disabled={loading}
                >
                  <IonIcon
                    icon={syncOutline}
                    className={`movies-refresh-btn__icon${loading ? " movies-refresh-btn__icon--spin" : ""}`}
                  />
                  <span>{loading ? "Syncing..." : "Refresh Schedules"}</span>
                </button>
                <div className="movies-status">
                  <span className="movies-status__dot" />
                  <span className="movies-status__text">
                    Auditorium Cloud Sync &bull; AI Seating Ready
                  </span>
                </div>
              </div>
            ) : visibleMovies.length === 0 ? (
              <div className="movies-no-match">
                <IonIcon icon={searchOutline} className="movies-no-match__icon" />
                <h2 className="movies-no-match__title">No matching movies found.</h2>
                <p className="movies-no-match__text">
                  Try a different title or genre, or switch the filter above.
                </p>
              </div>
            ) : (
              <div className="movies-grid">
                {visibleMovies.map((movie) => {
                  const posterSrc = resolveStorageUrl(movie.poster_url);
                  const posterOk = Boolean(posterSrc) && !failedPosterIds.includes(movie.id);

                  // Poster only (shared .poster-card from Home.css). Tapping opens
                  // the Details sheet, which holds the info and "View Showtimes".
                  return (
                    <article
                      className="poster-card"
                      key={movie.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${movie.title} details`}
                      onClick={() => setDetailsMovie(movie)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailsMovie(movie);
                        }
                      }}
                    >
                      {posterOk ? (
                        <img
                          src={posterSrc!}
                          alt=""
                          onError={() =>
                            setFailedPosterIds((prev) =>
                              prev.includes(movie.id) ? prev : [...prev, movie.id]
                            )
                          }
                        />
                      ) : (
                        <div className="poster-card__placeholder" aria-hidden="true">
                          <IonIcon icon={filmOutline} />
                          <span>{movie.title}</span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </IonContent>

        {detailsMovie && (
          <div
            className="movies-schedule-modal"
            onClick={() => setDetailsMovie(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${detailsMovie.title} details`}
          >
            <div className="movies-schedule-modal__backdrop" />
            <div
              className="movies-schedule-modal__sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="movies-schedule-modal__header">
                <div className="movies-schedule-modal__heading">
                  <span className="movies-schedule-modal__title">{detailsMovie.title}</span>
                  <span className="movies-schedule-modal__subtitle">Movie Details</span>
                </div>
                <button
                  type="button"
                  className="movies-schedule-modal__close"
                  onClick={() => setDetailsMovie(null)}
                  aria-label="Close details"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="movie-details">
                <div className="movie-details__top">
                  <div className="movie-card__poster">
                    {resolveStorageUrl(detailsMovie.poster_url) &&
                    !failedPosterIds.includes(detailsMovie.id) ? (
                      <img
                        src={resolveStorageUrl(detailsMovie.poster_url)!}
                        alt={`${detailsMovie.title} poster`}
                      />
                    ) : (
                      <div className="movie-card__poster-placeholder" aria-hidden="true">
                        <IonIcon icon={filmOutline} />
                      </div>
                    )}
                  </div>
                  <dl className="movie-details__facts">
                    {[
                      ["Genres", detailsMovie.genres.join(" • ")],
                      [
                        detailsBranches.length > 1 ? "Branches" : "Branch",
                        detailsBranches.join(", "),
                      ],
                      ["Rating", detailsMovie.age_rating],
                      [
                        "Runtime",
                        detailsMovie.duration_minutes
                          ? `${detailsMovie.duration_minutes} min`
                          : null,
                      ],
                      [
                        "Release",
                        detailsMovie.release_date
                          ? formatDate(detailsMovie.release_date.slice(0, 10))
                          : null,
                      ],
                      ["Language", detailsMovie.language],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <div className="movie-details__fact" key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>

                <p className="movie-details__synopsis">
                  {detailsMovie.description || "No synopsis available yet."}
                </p>

                {detailsMovie.trailer_url && /^https?:\/\//i.test(detailsMovie.trailer_url) && (
                  <a
                    className="movie-details__trailer"
                    href={detailsMovie.trailer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch Trailer
                  </a>
                )}

                <button
                  type="button"
                  className="schedule-item__reserve"
                  onClick={() => {
                    setSelectedMovie(detailsMovie);
                    setDetailsMovie(null);
                  }}
                >
                  View Showtimes
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedMovie && (
          <div
            className="movies-schedule-modal"
            onClick={() => setSelectedMovie(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedMovie.title} showtimes`}
          >
            <div className="movies-schedule-modal__backdrop" />
            <div
              className="movies-schedule-modal__sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="movies-schedule-modal__header">
                <div className="movies-schedule-modal__heading">
                  <span className="movies-schedule-modal__title">{selectedMovie.title}</span>
                  <span className="movies-schedule-modal__subtitle">Upcoming Showtimes</span>
                </div>
                <button
                  type="button"
                  className="movies-schedule-modal__close"
                  onClick={() => setSelectedMovie(null)}
                  aria-label="Close showtimes"
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="movies-schedule-modal__list">
                {selectedMovie.upcoming_schedules.map((schedule) => (
                  <div className="schedule-item" key={schedule.id}>
                    <div className="schedule-item__top">
                      <span className="schedule-item__branch">
                        {schedule.branch?.name ?? "Cinema"}
                      </span>
                      {schedule.screen?.name && (
                        <span className="schedule-item__screen">{schedule.screen.name}</span>
                      )}
                    </div>
                    <div className="schedule-item__row">
                      <span className="schedule-item__date">
                        {formatDate(schedule.show_date)}
                      </span>
                      <span className="schedule-item__time">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                      </span>
                    </div>
                    <div className="schedule-item__row">
                      <span className="schedule-item__price">
                        ₱{Number(schedule.ticket_price).toFixed(2)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="schedule-item__reserve"
                      onClick={() => {
                        setSelectedMovie(null);
                        navigate(ionRouter, `/booking/seats?schedule=${schedule.id}`);
                      }}
                    >
                      Reserve Seats
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={`pi-toast ${showToast ? "pi-toast--visible" : ""}`}>
          <div className="pi-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="pi-toast__text">
            <span className="pi-toast__title">{toastTitle}</span>
            <span className="pi-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>

        <HelpChat customerName={customerName} />

        <nav className="bottom-nav">
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, "/home");
            }}
          >
            <IonIcon icon={homeOutline} />
            <span>Home</span>
          </a>
          <a className="bottom-nav__item bottom-nav__item--active" href="#" aria-current="page">
            <IonIcon icon={filmOutline} />
            <span>Movies</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, "/tickets");
            }}
          >
            <IonIcon icon={ticketOutline} />
            <span>Tickets</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, "/history");
            }}
          >
            <IonIcon icon={receiptOutline} />
            <span>History</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, "/profile");
            }}
          >
            <IonIcon icon={personCircleOutline} />
            <span>Profile</span>
          </a>
        </nav>
      </div>
    </IonPage>
  );
};

export default Movies;
