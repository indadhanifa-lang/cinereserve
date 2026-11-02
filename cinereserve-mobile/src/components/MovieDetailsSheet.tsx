import { useState } from "react";
import { IonIcon, useIonRouter } from "@ionic/react";
import { closeOutline, filmOutline, locationOutline, playCircleOutline } from "ionicons/icons";
import { resolveStorageUrl } from "../lib/api";
import { formatRuntime } from "../lib/hours";
import { youtubeId } from "../lib/youtube";
import { navigate } from "../lib/nav";
import "../pages/Movies.css";

export interface UpcomingSchedule {
  id: number;
  show_date: string;
  start_time: string;
  end_time: string;
  ticket_price: string;
  branch: { id: number; name: string } | null;
  screen: { id: number; name: string } | null;
}

/** A /customer/showtimes movie (cinema showtimes or a mini cinema catalog entry). */
export interface MovieDetails {
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
  /** Set on mini cinema movies: no showtimes, booked any time there. */
  branch?: { id: number; name: string; booking_mode: "room" | "seat" };
}

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

/**
 * Movie details popup; "View Showtimes" swaps it to the showtimes list and
 * mini cinema movies go straight to room booking. Closing either view calls
 * onClose.
 */
const MovieDetailsSheet: React.FC<{ movie: MovieDetails; onClose: () => void }> = ({
  movie,
  onClose,
}) => {
  const ionRouter = useIonRouter();
  const [showtimes, setShowtimes] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  // YouTube trailers play inside the sheet; other links still open outside.
  const [trailerOpen, setTrailerOpen] = useState(false);
  const trailerId = movie.trailer_url ? youtubeId(movie.trailer_url) : null;
  const posterSrc = resolveStorageUrl(movie.poster_url);
  // Every branch screening the movie, taken from its upcoming showtimes.
  const branches = [
    ...new Set(
      [...movie.upcoming_schedules, movie]
        .map((item) => item.branch?.name)
        .filter((name): name is string => Boolean(name))
    ),
  ];

  // "PG-13 • 2h 35m • 2025 • English"
  const meta = [
    movie.age_rating,
    movie.duration_minutes ? formatRuntime(movie.duration_minutes) : null,
    movie.release_date?.slice(0, 4),
    movie.language,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <>
    <div
      className="movies-schedule-modal"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${movie.title} ${showtimes ? "showtimes" : "details"}`}
    >
      <div className="movies-schedule-modal__backdrop" />
      <div
        className={`movies-schedule-modal__sheet${showtimes ? "" : " movies-schedule-modal__sheet--details"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showtimes ? (
          <>
            <div className="movies-schedule-modal__header">
              <div className="movies-schedule-modal__heading">
                <span className="movies-schedule-modal__title">{movie.title}</span>
                <span className="movies-schedule-modal__subtitle">
                  Upcoming Showtimes
                </span>
              </div>
              <button
                type="button"
                className="movies-schedule-modal__close"
                onClick={onClose}
                aria-label="Close showtimes"
              >
                <IonIcon icon={closeOutline} />
              </button>
            </div>

            <div className="movies-schedule-modal__list">
              {movie.upcoming_schedules.map((schedule) => (
                <div className="schedule-item" key={schedule.id}>
                  <div className="schedule-item__top">
                    <span className="schedule-item__branch">{schedule.branch?.name ?? "Cinema"}</span>
                    {schedule.screen?.name && (
                      <span className="schedule-item__screen">{schedule.screen.name}</span>
                    )}
                  </div>
                  <div className="schedule-item__row">
                    <span className="schedule-item__date">{formatDate(schedule.show_date)}</span>
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
                      onClose();
                      navigate(ionRouter, `/booking/seats?schedule=${schedule.id}`);
                    }}
                  >
                    Reserve Seats
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="movie-details">
            {/* Hero: the poster again, blurred, behind the title block. */}
            <div className="movie-details__hero">
              {posterSrc && !posterFailed && (
                <img className="movie-details__backdrop" src={posterSrc} alt="" aria-hidden="true" />
              )}
              <button
                type="button"
                className="movies-schedule-modal__close movie-details__close"
                onClick={onClose}
                aria-label="Close details"
              >
                <IonIcon icon={closeOutline} />
              </button>
              <div className="movie-card__poster movie-details__poster">
                {posterSrc && !posterFailed ? (
                  <img
                    src={posterSrc}
                    alt={`${movie.title} poster`}
                    onError={() => setPosterFailed(true)}
                  />
                ) : (
                  <div className="movie-card__poster-placeholder" aria-hidden="true">
                    <IonIcon icon={filmOutline} />
                  </div>
                )}
              </div>
              <div className="movie-details__headline">
                <h2 className="movie-details__title">{movie.title}</h2>
                {meta && <p className="movie-details__meta">{meta}</p>}
                {movie.genres.length > 0 && (
                  <ul className="movie-details__genres" aria-label="Genres">
                    {movie.genres.map((genre) => (
                      <li key={genre}>{genre}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="movie-details__body">
              {branches.length > 0 && (
                <p className="movie-details__branch">
                  <IonIcon icon={locationOutline} aria-hidden="true" />
                  <span>{branches.join(", ")}</span>
                </p>
              )}

              <p className="movie-details__synopsis">
                {movie.description || "No synopsis available yet."}
              </p>

              <div className="movie-details__actions">
                {trailerId ? (
                  <button
                    type="button"
                    className="movie-details__trailer"
                    onClick={() => setTrailerOpen(true)}
                  >
                    <IonIcon icon={playCircleOutline} aria-hidden="true" />
                    Trailer
                  </button>
                ) : movie.trailer_url && /^https?:\/\//i.test(movie.trailer_url) && (
                  <a
                    className="movie-details__trailer"
                    href={movie.trailer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IonIcon icon={playCircleOutline} aria-hidden="true" />
                    Trailer
                  </a>
                )}

                <button
                  type="button"
                  className="schedule-item__reserve movie-details__book"
                  onClick={() => {
                    if (movie.branch) {
                      onClose();
                      navigate(ionRouter, `/booking/room?branch=${movie.branch.id}&movie=${movie.id}`);
                    } else {
                      setShowtimes(true);
                    }
                  }}
                >
                  {/* Mini cinemas rent either the whole room or single seats. */}
                  {movie.branch
                    ? movie.branch.booking_mode === "seat" ? "Book Seats" : "Book a Room"
                    : "View Showtimes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {trailerOpen && trailerId && (
      <div
        className="trailer-modal"
        onClick={() => setTrailerOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label={`${movie.title} trailer`}
      >
        <button
          type="button"
          className="movies-schedule-modal__close trailer-modal__close"
          onClick={() => setTrailerOpen(false)}
          aria-label="Close trailer"
        >
          <IonIcon icon={closeOutline} />
        </button>
        <iframe
          className="trailer-modal__player"
          src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&playsinline=1&rel=0`}
          title={`${movie.title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
};

export default MovieDetailsSheet;
