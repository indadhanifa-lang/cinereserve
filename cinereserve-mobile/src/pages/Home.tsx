import { useCallback, useEffect, useRef, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  filmOutline,
  homeOutline,
  notificationsOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  ticketOutline,
} from "ionicons/icons";
import { apiGetAuth, resolveStorageUrl } from "../lib/api";
import { navigate } from "../lib/nav";
import HelpChat from "../components/HelpChat";
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

interface ComingSoonMovie {
  id: number;
  title: string;
  poster_url: string | null;
  duration_minutes: number | null;
  release_date: string;
  age_rating: string | null;
  genres: string[];
}

interface ShowtimesResponse {
  movies: ShowtimeMovie[];
  coming_soon?: ComingSoonMovie[];
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

/** Subset of /customer/tickets used by the "Your Next Show" card. */
interface UpcomingTicket {
  id: number;
  is_active: boolean;
  movie: { title: string } | null;
  schedule: { show_date: string; start_time: string } | null;
  branch: { name: string | null };
  screen: { name: string | null };
  seats: { label: string }[];
}

interface TicketsResponse {
  tickets: UpcomingTicket[];
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

/** "Opens Nov 14, 2026" — parsed as a local date so the day never shifts. */
const formatReleaseDate = (releaseDate: string): string => {
  const [year, month, day] = releaseDate.slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return `Opens ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
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

  return `${dayLabel} • ${formatTime(schedule.start_time)}`;
};

/** HH:MM:SS → "6:00 PM" */
const formatTime = (time: string): string => {
  const [rawHours, minutes] = time.split(":").map(Number);
  const hours = rawHours ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, "0")} ${period}`;
};

// Schedules are cinema wall-clock times (Asia/Manila, fixed UTC+8, no DST),
// so they are pinned to that offset instead of the device's timezone.
const CINEMA_TIMEZONE = "Asia/Manila";
const showtimeMs = (showDate: string, time: string): number =>
  new Date(`${showDate}T${time}+08:00`).getTime();

/** Cinema-local today as YYYY-MM-DD (en-CA formats dates that way). */
const cinemaToday = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CINEMA_TIMEZONE }).format(new Date());

/** "In 2 days" / "In 2h 15m" / "In 40m" / "Starting now" / "Now playing" */
const formatCountdown = (startMs: number, nowMs: number): string => {
  const diffMs = startMs - nowMs;
  if (diffMs <= 0) return "Now playing";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Starting now";
  const days = Math.floor(mins / 1440);
  if (days >= 1) return `In ${days} ${days === 1 ? "day" : "days"}`;
  const hours = Math.floor(mins / 60);
  return hours > 0 ? `In ${hours}h ${mins % 60}m` : `In ${mins}m`;
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

/**
 * Swipeable carousel that also auto-advances every 5s, wrapping to the first
 * card. A manual swipe or dot tap re-arms the countdown, a finger on it pauses
 * it, and reduced motion turns autoplay off. Spread `props` on the scroller;
 * cards are assumed to sit 12px apart.
 */
function useAutoCarousel(count: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const heldRef = useRef(false);
  const [active, setActive] = useState(0);

  /** Active dot follows the snapped card; the last dot wins once scrolled to the end
   * (the last card can't snap to the start edge when it's narrower than the viewport). */
  const onScroll = () => {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    const step = first.offsetWidth + 12; // card width + gap
    setActive(atEnd ? el.children.length - 1 : Math.round(el.scrollLeft / step));
  };

  const goTo = useCallback((index: number) => {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    const target = el?.children[index] as HTMLElement | undefined;
    if (!el || !first || !target) return;
    el.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Interval (not timeout) so a tick skipped while held doesn't stall autoplay.
    const timer = setInterval(() => {
      if (heldRef.current) return;
      goTo((Math.min(active, count - 1) + 1) % count);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, count, goTo]);

  const hold = (held: boolean) => () => {
    heldRef.current = held;
  };

  return {
    active,
    goTo,
    props: {
      ref,
      onScroll,
      onPointerDown: hold(true),
      onPointerUp: hold(false),
      onPointerCancel: hold(false),
      onPointerLeave: hold(false),
    },
  };
}

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
  const [comingSoon, setComingSoon] = useState<ComingSoonMovie[]>([]);
  const [upcomingTickets, setUpcomingTickets] = useState<UpcomingTicket[]>([]);
  const ticketCarousel = useAutoCarousel(upcomingTickets.length);
  const [now, setNow] = useState(() => Date.now());
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const [failedPosterIds, setFailedPosterIds] = useState<number[]>([]);
  const nowShowing = useAutoCarousel(movies.length);
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

    const [profileResult, showtimesResult, pendingResult, ticketsResult] = await Promise.allSettled([
      apiGetAuth<ProfileResponse>("/customer/me"),
      apiGetAuth<ShowtimesResponse>("/customer/showtimes"),
      apiGetAuth<PendingResponse>("/customer/reservations/pending"),
      apiGetAuth<TicketsResponse>("/customer/tickets"),
    ]);

    // A newer request superseded this one — discard every write.
    if (requestId !== requestRef.current) return;

    setNow(Date.now());

    // Active tickets come first, nearest showtime first. A failure just hides
    // the section; the Tickets tab reports its own errors.
    setUpcomingTickets(
      ticketsResult.status === "fulfilled"
        ? (ticketsResult.value.tickets ?? []).filter((ticket) => ticket.is_active && ticket.schedule)
        : []
    );

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
      setComingSoon(showtimesResult.value.coming_soon ?? []);
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

  // Keeps the countdown and the "Showing Today" times current while Home stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const today = cinemaToday();
  const todayShows = movies
    .map((movie) => ({
      movie,
      schedules: movie.upcoming_schedules.filter(
        (schedule) =>
          schedule.show_date === today &&
          showtimeMs(schedule.show_date, schedule.start_time) > now
      ),
    }))
    .filter((show) => show.schedules.length > 0);

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

            {upcomingTickets.length > 0 && (
              <section className="home-pending" aria-label="Your Upcoming Shows">
                <div className="section-label">
                  <span>{upcomingTickets.length === 1 ? "Your Next Show" : "Your Upcoming Shows"}</span>
                  {upcomingTickets.length > 1 && (
                    <span className="section-label__accent">
                      {upcomingTickets.length} Tickets
                    </span>
                  )}
                </div>

                {/* Swipe or let it auto-advance; the next card peeks in to hint there is more. */}
                <div className="ticket-swipe" {...ticketCarousel.props}>
                  {upcomingTickets.map((ticket) => {
                    const schedule = ticket.schedule!;
                    const title = ticket.movie?.title ?? "Untitled movie";
                    const openTickets = () => navigate(ionRouter, "/tickets");

                    return (
                      <article
                        className="pending-card next-ticket"
                        key={ticket.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`View ticket for ${title}`}
                        onClick={openTickets}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openTickets();
                          }
                        }}
                      >
                        <div className="pending-card__top">
                          <h3 className="pending-card__title">{title}</h3>
                          <span className="pending-card__badge">
                            {formatCountdown(
                              showtimeMs(schedule.show_date, schedule.start_time),
                              now
                            )}
                          </span>
                        </div>
                        <p className="pending-card__place">
                          {[ticket.branch?.name ?? "Cinema", ticket.screen?.name]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                        <p className="pending-card__showtime">{formatShowtime(schedule)}</p>
                        {ticket.seats.length > 0 && (
                          <p className="pending-card__seats">
                            Seats: {ticket.seats.map((seat) => seat.label).join(", ")}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>

                {upcomingTickets.length > 1 && (
                  <div className="showing-dots ticket-swipe__dots">
                    {upcomingTickets.map((ticket, index) => {
                      const current =
                        index === Math.min(ticketCarousel.active, upcomingTickets.length - 1);
                      return (
                        <button
                          key={ticket.id}
                          type="button"
                          className={`showing-dots__dot${current ? " showing-dots__dot--active" : ""}`}
                          aria-label={`Show ticket for ${ticket.movie?.title ?? "movie"}`}
                          aria-current={current ? "true" : undefined}
                          onClick={() => ticketCarousel.goTo(index)}
                        />
                      );
                    })}
                  </div>
                )}
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

                <div className="showing-list" {...nowShowing.props}>
                  {movies.map((movie) => {
                    const posterSrc = resolveStorageUrl(movie.poster_url);
                    const posterOk =
                      Boolean(posterSrc) &&
                      !failedPosterIds.includes(movie.id);

                    // Poster only; the title lives in aria-label, and in the
                    // placeholder when there is no poster to show.
                    return (
                      <article
                        className="poster-card"
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
                        {posterOk ? (
                          <img
                            src={posterSrc!}
                            alt=""
                            onError={() =>
                              setFailedPosterIds((prev) =>
                                prev.includes(movie.id)
                                  ? prev
                                  : [...prev, movie.id]
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

                {movies.length > 1 && (
                  <div className="showing-dots">
                    {movies.map((movie, index) => {
                      const current = index === Math.min(nowShowing.active, movies.length - 1);
                      return (
                        <button
                          key={movie.id}
                          type="button"
                          className={`showing-dots__dot${current ? " showing-dots__dot--active" : ""}`}
                          aria-label={`Show ${movie.title}`}
                          aria-current={current ? "true" : undefined}
                          onClick={() => nowShowing.goTo(index)}
                        />
                      );
                    })}
                  </div>
                )}
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

            {!loading && todayShows.length > 0 && (
              <section className="home-today" aria-label="Showing Today">
                <div className="section-label">
                  <span>Showing Today</span>
                  <span className="section-label__accent">Tap a time to book</span>
                </div>

                <div className="home-pending__list">
                  {todayShows.map(({ movie, schedules }) => (
                    <div className="today-card" key={movie.id}>
                      <h3 className="today-card__title">{movie.title}</h3>
                      <div className="today-card__times">
                        {schedules.map((schedule) => (
                          <button
                            type="button"
                            className="today-card__time"
                            key={schedule.id}
                            aria-label={`Book ${movie.title} at ${formatTime(schedule.start_time)}${
                              schedule.branch?.name ? `, ${schedule.branch.name}` : ""
                            }`}
                            onClick={() =>
                              navigate(ionRouter, `/booking/seats?schedule=${schedule.id}`)
                            }
                          >
                            <span className="today-card__clock">
                              {formatTime(schedule.start_time)}
                            </span>
                            {schedule.branch?.name && (
                              <span className="today-card__branch">{schedule.branch.name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {comingSoon.length > 0 && (
              <>
                <div className="section-label">
                  <span>Coming Soon</span>
                  <span className="section-label__accent">
                    {comingSoon.length} {comingSoon.length === 1 ? "Movie" : "Movies"}
                  </span>
                </div>

                <div className="feature-list">
                  {comingSoon.map((movie) => {
                    const posterSrc = resolveStorageUrl(movie.poster_url);
                    const posterOk =
                      Boolean(posterSrc) && !failedPosterIds.includes(movie.id);
                    const facts = [
                      movie.genres.join(" / "),
                      movie.age_rating,
                      movie.duration_minutes ? `${movie.duration_minutes} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <div className="feature-card" key={movie.id}>
                        <div className="feature-card__poster">
                          {posterOk ? (
                            <img
                              src={posterSrc!}
                              alt={`${movie.title} poster`}
                              onError={() =>
                                setFailedPosterIds((prev) =>
                                  prev.includes(movie.id) ? prev : [...prev, movie.id]
                                )
                              }
                            />
                          ) : (
                            <IonIcon icon={filmOutline} aria-hidden="true" />
                          )}
                        </div>
                        <div className="feature-card__body">
                          <div className="feature-card__heading">
                            <span className="feature-card__title">{movie.title}</span>
                          </div>
                          <span className="feature-card__badge">
                            {formatReleaseDate(movie.release_date)}
                          </span>
                          {facts && <p className="feature-card__text">{facts}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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

        <HelpChat customerName={user?.name} />

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
