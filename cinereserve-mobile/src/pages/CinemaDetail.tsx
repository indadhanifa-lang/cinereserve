import { useEffect, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter } from "@ionic/react";
import { useSearchParams } from "react-router-dom";
import {
  arrowBackOutline,
  callOutline,
  filmOutline,
  gridOutline,
  locationOutline,
  peopleOutline,
  timeOutline,
} from "ionicons/icons";
import { apiGetAuth, resolveStorageUrl } from "../lib/api";
import { closesAt, formatClock, formatRuntime, groupHours, type OperatingHours } from "../lib/hours";
import { navigate } from "../lib/nav";
import "./Cinemas.css";

interface CinemaDetailResponse {
  branch: {
    id: number;
    name: string;
    description: string | null;
    category: string;
    booking_mode: "room" | "seat";
    address: string;
    city: string;
    province: string | null;
    phone: string | null;
    photos: string[] | null;
    logo_url: string | null;
    operating_hours: OperatingHours | null;
  };
  rooms: { id: number; name: string; capacity: number; rental_price: string | null }[];
  movies: { id: number; title: string; poster_url: string | null; duration_minutes: number; age_rating: string | null }[];
  schedules: {
    id: number;
    show_date: string;
    start_time: string;
    ticket_price: string;
    movie: { title: string } | null;
    screen: { name: string } | null;
  }[];
}

const formatTime = formatClock;

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

const CinemaDetail: React.FC = () => {
  const ionRouter = useIonRouter();
  const [params] = useSearchParams();
  const id = params.get("id");
  const [data, setData] = useState<CinemaDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ionic reuses this view, so reload whenever the id in the URL changes.
  useEffect(() => {
    if (!id) return;
    setData(null);
    setError(null);
    apiGetAuth<CinemaDetailResponse>(`/public/branches/${id}`)
      .then(setData)
      .catch((err: { status?: number }) =>
        setError(err.status === 404 ? "This cinema isn't taking bookings right now." : "Unable to load this cinema.")
      );
  }, [id]);

  const branch = data?.branch;
  const photo = resolveStorageUrl(branch?.photos?.[0]);
  const logo = resolveStorageUrl(branch?.logo_url ?? branch?.photos?.[0]);
  const status = branch?.operating_hours ? closesAt(branch.operating_hours) : null;
  const place = branch ? [branch.address, branch.city, branch.province].filter(Boolean).join(", ") : "";
  const mapQuery = encodeURIComponent(`${branch?.name}, ${place}`);
  const unit = branch?.booking_mode === "room" ? "per movie" : "per seat";

  return (
    <IonPage>
      <div className="cinemas-page">
        <IonContent scrollY className="cinemas-content">
          <button type="button" className="cinema-hero__back" aria-label="Back" onClick={() => navigate(ionRouter, "/cinemas")}>
            <IonIcon icon={arrowBackOutline} />
          </button>

          {error ? (
            <p className="cinemas-empty cinema-detail__state">{error}</p>
          ) : !data || !branch ? (
            <div className="cinemas-empty cinema-detail__state">
              <IonSpinner name="dots" />
            </div>
          ) : (
            <>
              {/* A photo fills the banner; a logo alone is too square to crop, so it only tints a blurred backdrop. */}
              <div className="cinema-hero">
                <div
                  className={`cinema-hero__banner${photo ? "" : " cinema-hero__banner--blur"}`}
                  style={logo ? { backgroundImage: `url("${photo ?? logo}")` } : undefined}
                />
                <div className="cinema-hero__identity">
                  <div className="cinema-hero__logo">
                    {logo ? <img src={logo} alt="" /> : <IonIcon icon={filmOutline} />}
                  </div>
                  <div className="cinema-hero__text">
                    <h1>{branch.name}</h1>
                    <p>
                      <IonIcon icon={locationOutline} aria-hidden="true" />
                      <span>{[branch.city, branch.province].filter(Boolean).join(", ")}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="cinemas-body cinema-detail">
                <div className="cinema-detail__chips">
                  {branch.operating_hours && (
                    <span className={`cinema-chip ${status ? "cinema-chip--open" : "cinema-chip--closed"}`}>
                      <i aria-hidden="true" />
                      {status ? `Open · ${status}` : "Closed now"}
                    </span>
                  )}
                  <span className="cinema-chip">
                    <IonIcon icon={branch.booking_mode === "room" ? peopleOutline : gridOutline} aria-hidden="true" />
                    {branch.booking_mode === "room" ? "Whole room" : "Per seat"}
                  </span>
                </div>

                {branch.description && <p className="cinema-detail__desc">{branch.description}</p>}

                {(branch.photos?.length ?? 0) > 1 && (
                  <div className="cinema-detail__gallery">
                    {branch.photos!.slice(1).map((url) => (
                      <img key={url} src={resolveStorageUrl(url) ?? ""} alt="" />
                    ))}
                  </div>
                )}

                <section className="cinema-detail__section">
                  <div className="cinema-detail__row">
                    <IonIcon icon={locationOutline} aria-hidden="true" />
                    <div>
                      <small>Address</small>
                      <span>{place}</span>
                    </div>
                  </div>
                  {/* Keyless embed, so the map shows inside the app without a Maps API key. */}
                  <iframe
                    className="cinema-detail__map"
                    title={`Map of ${branch.name}`}
                    src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  {branch.phone && (
                    <div className="cinema-detail__row">
                      <IonIcon icon={callOutline} aria-hidden="true" />
                      <div>
                        <small>Phone</small>
                        <span>{branch.phone}</span>
                      </div>
                    </div>
                  )}
                  {branch.operating_hours && (
                    <div className="cinema-detail__row">
                      <IonIcon icon={timeOutline} aria-hidden="true" />
                      <div>
                        <small>Hours of operation</small>
                        <dl className="cinema-detail__hours">
                          {groupHours(branch.operating_hours).map(({ days, time }) => (
                            <div key={days}>
                              <dt>{days}</dt>
                              <dd>{time}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </div>
                  )}
                </section>

                {branch.category === "mini_cinema" && data.rooms.length > 0 && (
                  <section className="cinema-detail__block">
                    <h2 className="cinema-detail__heading">
                      Rooms <span>{data.rooms.length}</span>
                    </h2>
                    <div className="cinema-detail__rooms">
                      {data.rooms.map((room) => (
                        <div key={room.id} className="cinema-room">
                          <strong>{room.name}</strong>
                          <small>
                            <IonIcon icon={peopleOutline} aria-hidden="true" />
                            Up to {room.capacity}
                          </small>
                          {room.rental_price && (
                            <span className="cinema-room__price">
                              ₱{Number(room.rental_price).toFixed(2)}
                              <small>{unit}</small>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {branch.category === "mini_cinema" ? (
                  <section className="cinema-detail__block">
                    <h2 className="cinema-detail__heading">Pick a movie</h2>
                    <p className="cinema-detail__hint">Watch any movie, any time we're open. You choose the room, date and start time.</p>
                    {data.movies.length === 0 ? (
                      <p className="cinemas-empty">No movies yet.</p>
                    ) : (
                      data.movies.map((movie) => {
                        const poster = resolveStorageUrl(movie.poster_url);
                        return (
                          <button
                            type="button"
                            key={movie.id}
                            className="cinema-detail__show"
                            onClick={() => navigate(ionRouter, `/booking/room?branch=${branch.id}&movie=${movie.id}`)}
                          >
                            <span className="cinema-detail__poster">
                              {poster ? <img src={poster} alt="" /> : <IonIcon icon={filmOutline} />}
                            </span>
                            <span className="cinema-detail__show-info">
                              <strong>{movie.title}</strong>
                              <small>
                                {formatRuntime(movie.duration_minutes)}{movie.age_rating ? ` · ${movie.age_rating}` : ""}
                              </small>
                            </span>
                            <span className="cinema-detail__book">Book</span>
                          </button>
                        );
                      })
                    )}
                  </section>
                ) : (
                  <section className="cinema-detail__block">
                    <h2 className="cinema-detail__heading">Showtimes</h2>
                    {data.schedules.length === 0 ? (
                      <p className="cinemas-empty">No upcoming showtimes yet.</p>
                    ) : (
                      data.schedules.map((schedule) => (
                        <button
                          type="button"
                          key={schedule.id}
                          className="cinema-detail__show"
                          onClick={() => navigate(ionRouter, `/booking/seats?schedule=${schedule.id}`)}
                        >
                          <span className="cinema-detail__show-info">
                            <strong>{schedule.movie?.title ?? "Movie"}</strong>
                            <small>
                              {formatDate(schedule.show_date)} · {formatTime(schedule.start_time)} · {schedule.screen?.name}
                            </small>
                          </span>
                          <span className="cinema-detail__price">
                            ₱{Number(schedule.ticket_price).toFixed(2)}
                            <small>per seat</small>
                          </span>
                        </button>
                      ))
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </IonContent>
      </div>
    </IonPage>
  );
};

export default CinemaDetail;
