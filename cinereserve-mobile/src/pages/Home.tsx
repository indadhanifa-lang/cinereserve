import { useCallback, useEffect, useRef, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  filmOutline,
  flashOutline,
  homeOutline,
  notificationsOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  sparklesOutline,
  ticketOutline,
  volumeHighOutline,
} from "ionicons/icons";
import { apiGetAuth, resolveStorageUrl } from "../lib/api";
import { navigate } from "../lib/nav";
import "./Home.css";

interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
}

interface ProfileResponse {
  user: CustomerProfile;
}

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
  poster_url: string | null;
  duration_minutes: number | null;
  age_rating: string | null;
  genres: string[];
  upcoming_schedules: UpcomingSchedule[];
}

interface ShowtimesResponse {
  movies: ShowtimeMovie[];
}

interface PendingReservation {
  id: number;
  reservation_code: string;
  status: string;
  total_amount: string;
  reserved_at: string | null;
  expires_at: string | null;
  movie: { title: string | null; poster_url: string | null };
  branch: { name: string | null };
  screen: { name: string | null };
  schedule: { show_date: string | null; start_time: string | null };
  seats: { label: string }[];
}

interface PendingResponse {
  reservations: PendingReservation[];
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
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

/** "Today • 6:00 PM" / "Tomorrow • 6:00 PM" / "Sep 27 • 6:00 PM" */
const formatShowtime = (schedule: { show_date: string; start_time: string }): string => {
  const [year, month, day] = schedule.show_date.split("-").map(Number);
  const target = new Date(year, (month ?? 1) - 1, day ?? 1);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  let dayLabel: string;
  if (diffDays === 0) {
    dayLabel = "Today";
  } else if (diffDays === 1) {
    dayLabel = "Tomorrow";
  } else {
    dayLabel = target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const [rawHours, minutes] = schedule.start_time.split(":").map(Number);
  const hours = rawHours ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${dayLabel} • ${hour12}:${String(minutes ?? 0).padStart(2, "0")} ${period}`;
};

/** "250.00" → "₱250.00" — display only; the payment page re-fetches the
 * backend totals as the authority. */
const formatPrice = (value: string): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

/** Backend ISO-8601 hold expiry → "2:30 PM". Absolute time only — no
 * countdown, no setInterval, no client-clock drift. */
const formatHoldExpiry = (iso: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const ProjectorIcon: React.FC = () => (
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
    <circle cx="24" cy="18" r="10" fill="none" stroke="currentColor" />
    <circle cx="24" cy="18" r="4" fill="currentColor" />
    <path d="M14 26 L10 38 L38 38 L34 26" />
    <line x1="19" y1="38" x2="17" y2="42" />
    <line x1="29" y1="38" x2="31" y2="42" />
    <path d="M32 12 L42 8 L42 20 L32 16" opacity={0.6} strokeDasharray="2 2" />
    <circle cx="20" cy="15" r="1" fill="currentColor" />
    <circle cx="28" cy="15" r="1" fill="currentColor" />
    <circle cx="24" cy="22" r="1" fill="currentColor" />
  </svg>
);

const Home: React.FC = () => {
  const ionRouter = useIonRouter();
  const [subscribed, setSubscribed] = useState(false);

  const [user, setUser] = useState<CustomerProfile | null>(null);
  const [movies, setMovies] = useState<ShowtimeMovie[]>([]);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const [failedPosterIds, setFailedPosterIds] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastSubtitle, setToastSubtitle] = useState("");
  // Monotonic id: only the newest request may write state, so a slow
  // earlier response can never overwrite a fresher one.
  const requestRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  // Single loader for the whole page: fetches profile, showtimes and
  // pending payments in parallel, each failure handled independently so
  // one broken endpoint never blanks the page or blocks the others.
  const loadHomeData = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);

    const [profileResult, showtimesResult, pendingResult] = await Promise.allSettled([
      apiGetAuth<ProfileResponse>("/customer/me"),
      apiGetAuth<ShowtimesResponse>("/customer/showtimes"),
      apiGetAuth<PendingResponse>("/customer/reservations/pending"),
    ]);

    // A newer request superseded this one — discard every write.
    if (requestId !== requestRef.current) return;

    if (profileResult.status === "fulfilled") {
      setUser(profileResult.value.user);
    } else {
      showToastMessage(
        "Unable to load profile",
        getErrorMessage(profileResult.reason, "Please try again later.")
      );
    }

    if (showtimesResult.status === "fulfilled") {
      setMovies(showtimesResult.value.movies ?? []);
    } else {
      showToastMessage(
        "Unable to load movies",
        getErrorMessage(showtimesResult.reason, "Please try again later.")
      );
    }

    if (pendingResult.status === "fulfilled") {
      setPendingReservations(pendingResult.value.reservations ?? []);
    } else {
      // Hide the section rather than show a possibly-stale "payable" card;
      // the payment page remains the expiry authority on the next attempt.
      setPendingReservations([]);
      showToastMessage(
        "Unable to load pending payment",
        getErrorMessage(pendingResult.reason, "Please try again later.")
      );
    }

    setLoading(false);
  }, [showToastMessage]);

  // First entry and every return to the Home tab refreshes the data.
  useIonViewWillEnter(() => {
    loadHomeData();
  });

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Absolute URL for the stored relative path; null stays null. Never hardcoded.
  const avatarSrc = resolveStorageUrl(user?.avatar_url);
  const showAvatarImage = Boolean(avatarSrc) && avatarSrc !== failedAvatarSrc;

  const handleShowtimes = () => {
    navigate(ionRouter, "/movies");
  };

  return (
    <IonPage>
      <div className="home-page">
        <header className="home-header">
          <div className="home-header__brand">
            <img
              src="/logo.png"
              alt="CineReserve AI"
              className="home-header__logo"
            />
          </div>
          <div className="home-header__actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Notifications"
            >
              <IonIcon icon={notificationsOutline} />
            </button>
            <div className="home-header__avatar">
              {user ? (
                <>
                  <span className="home-header__initials" aria-hidden="true">
                    {getInitials(user.name)}
                  </span>
                  {avatarSrc && showAvatarImage && (
                    <img
                      key={avatarSrc}
                      src={avatarSrc}
                      alt=""
                      aria-hidden="true"
                      onError={() => setFailedAvatarSrc(avatarSrc)}
                    />
                  )}
                </>
              ) : (
                <IonIcon icon={personOutline} aria-hidden="true" />
              )}
            </div>
          </div>
        </header>

        <IonContent scrollY className="home-content">
          <div className="home-body">
            <section className="home-hero">
              <span className="home-hero__badge">
                <IonIcon icon={sparklesOutline} />
                AI-Powered Cinema
              </span>
              <h1 className="home-hero__title">Welcome to CineReserve</h1>
              <p className="home-hero__subtext">
                Find movies, Make reservations, and enjoy the show.
              </p>
            </section>

            {pendingReservations.length > 0 && (
              <section className="home-pending" aria-label="Pending Payment">
                <div className="section-label">
                  <span>Pending Payment</span>
                  <span className="section-label__accent">
                    {pendingReservations.length}{" "}
                    {pendingReservations.length === 1 ? "Reservation" : "Reservations"}
                  </span>
                </div>

                <div className="home-pending__list">
                  {pendingReservations.map((item) => {
                    const holdExpiry = formatHoldExpiry(item.expires_at);
                    const place = [
                      item.branch?.name ?? "Cinema",
                      item.screen?.name ?? null,
                    ]
                      .filter(Boolean)
                      .join(" • ");
                    const seatLabels = item.seats.map((seat) => seat.label).join(", ");
                    const showDate = item.schedule?.show_date;
                    const startTime = item.schedule?.start_time;

                    return (
                      <article className="pending-card" key={item.id}>
                        <div className="pending-card__top">
                          <h3 className="pending-card__title">
                            {item.movie?.title ?? "Untitled movie"}
                          </h3>
                          <span className="pending-card__badge">Payment pending</span>
                        </div>
                        <p className="pending-card__place">{place}</p>
                        {showDate && startTime && (
                          <p className="pending-card__showtime">
                            {formatShowtime({ show_date: showDate, start_time: startTime })}
                          </p>
                        )}
                        {seatLabels && (
                          <p className="pending-card__seats">Seats: {seatLabels}</p>
                        )}
                        <div className="pending-card__meta">
                          <span className="pending-card__total">
                            Total: {formatPrice(item.total_amount)}
                          </span>
                          {holdExpiry && (
                            <span className="pending-card__hold">
                              Hold expires at {holdExpiry}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="pending-card__cta"
                          aria-label={`Continue payment for ${item.movie?.title ?? "reservation"}`}
                          onClick={() =>
                            navigate(ionRouter, `/booking/payment?reservation=${item.id}`)
                          }
                        >
                          Continue Payment
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {loading ? (
              <div className="home-loading" role="status" aria-live="polite">
                <IonSpinner name="dots" />
                <span className="home-loading__text">Finding showtimes…</span>
              </div>
            ) : movies.length > 0 ? (
              <section className="now-showing" aria-label="Now Showing">
                <div className="section-label">
                  <span>Now Showing</span>
                  <span className="section-label__accent">
                    {movies.length} {movies.length === 1 ? "Title" : "Titles"}
                  </span>
                </div>

                <div className="showing-list">
                  {movies.map((movie) => {
                    const nearest = movie.upcoming_schedules[0];
                    const posterSrc = resolveStorageUrl(movie.poster_url);
                    const posterOk =
                      Boolean(posterSrc) &&
                      !failedPosterIds.includes(movie.id);
                    const facts = [
                      movie.age_rating,
                      movie.duration_minutes
                        ? `${movie.duration_minutes} min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <article
                        className="movie-card"
                        key={movie.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View showtimes for ${movie.title}`}
                        onClick={() => handleShowtimes()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleShowtimes();
                          }
                        }}
                      >
                        <div className="movie-card__poster">
                          {posterOk ? (
                            <img
                              src={posterSrc!}
                              alt={`${movie.title} poster`}
                              onError={() =>
                                setFailedPosterIds((prev) =>
                                  prev.includes(movie.id)
                                    ? prev
                                    : [...prev, movie.id]
                                )
                              }
                            />
                          ) : (
                            <div
                              className="movie-card__poster-placeholder"
                              aria-hidden="true"
                            >
                              <IonIcon icon={filmOutline} />
                            </div>
                          )}
                        </div>

                        <div className="movie-card__body">
                          <h3 className="movie-card__title">{movie.title}</h3>
                          {movie.genres.length > 0 && (
                            <p className="movie-card__genres">
                              {movie.genres.join(" / ")}
                            </p>
                          )}
                          {facts && <p className="movie-card__facts">{facts}</p>}

                          {nearest && (
                            <div className="movie-card__showtime">
                              {nearest.branch?.name && (
                                <span className="movie-card__branch">
                                  {nearest.branch.name}
                                </span>
                              )}
                              <span className="movie-card__time">
                                {formatShowtime(nearest)}
                              </span>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="coming-soon-card">
                <div className="coming-soon-card__glow" aria-hidden="true" />
                <div className="coming-soon-card__icon-wrap">
                  <div
                    className="coming-soon-card__icon-glow"
                    aria-hidden="true"
                  />
                  <div className="coming-soon-card__icon">
                    <ProjectorIcon />
                  </div>
                </div>
                <span className="coming-soon-card__pill">
                  <span className="coming-soon-card__dot" aria-hidden="true" />
                  Season Premiere Soon
                </span>
                <h2 className="coming-soon-card__title">Movies Coming Soon</h2>
                <p className="coming-soon-card__subtext">
                  Available movies and cinema schedules will appear here.
                </p>
                <button
                  type="button"
                  className={`notify-button${subscribed ? " notify-button--active" : ""}`}
                  onClick={() => setSubscribed((v) => !v)}
                >
                  <IonIcon
                    icon={
                      subscribed ? checkmarkCircleOutline : notificationsOutline
                    }
                  />
                  <span>
                    {subscribed
                      ? "Notifications On (This Device)"
                      : "Notify Me When Tickets Drop"}
                  </span>
                </button>
              </div>
            )}

            <div className="section-label">
              <span>Upcoming Features</span>
              <span className="section-label__accent">CineReserve 2.0</span>
            </div>

            <div className="feature-list">
              <div className="feature-card">
                <div className="feature-card__icon">
                  <IonIcon icon={volumeHighOutline} />
                </div>
                <div className="feature-card__body">
                  <div className="feature-card__heading">
                    <span className="feature-card__title">Smart Pick</span>
                    <span className="feature-card__badge">AI Core</span>
                  </div>
                  <p className="feature-card__text">
                    AI seating tailored for optimal sound and sightlines,
                    matched to each auditorium&apos;s acoustics.
                  </p>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-card__icon">
                  <IonIcon icon={flashOutline} />
                </div>
                <div className="feature-card__body">
                  <div className="feature-card__heading">
                    <span className="feature-card__title">Instant Pass</span>
                    <span className="feature-card__badge feature-card__badge--alt">
                      Fast-Track
                    </span>
                  </div>
                  <p className="feature-card__text">
                    Reserve in seconds with live hall availability and
                    tap-to-enter digital wallet boarding passes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </IonContent>

        <div className={`pi-toast ${showToast ? "pi-toast--visible" : ""}`}>
          <div className="pi-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="pi-toast__text">
            <span className="pi-toast__title">{toastTitle}</span>
            <span className="pi-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>

        <nav className="bottom-nav">
          <a
            className="bottom-nav__item bottom-nav__item--active"
            href="#"
            aria-current="page"
          >
            <IonIcon icon={homeOutline} />
            <span>Home</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, "/movies");
            }}
          >
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

export default Home;
