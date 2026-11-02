import { useEffect, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter } from "@ionic/react";
import { useSearchParams } from "react-router-dom";
import {
  addOutline,
  arrowBackOutline,
  checkmarkCircle,
  filmOutline,
  peopleOutline,
  removeOutline,
} from "ionicons/icons";
import { apiGetAuth, apiPostAuth, resolveStorageUrl } from "../lib/api";
import { formatClock, formatRuntime, startTimes, type OperatingHours } from "../lib/hours";
import { navigate } from "../lib/nav";
import "./Cinemas.css";

interface CinemaMovie {
  id: number;
  title: string;
  poster_url: string | null;
  duration_minutes: number;
  age_rating: string | null;
  genres: string[];
}

interface Cinema {
  branch: { id: number; name: string; booking_mode: "room" | "seat"; operating_hours: OperatingHours | null };
  rooms: {
    id: number;
    name: string;
    /** By room: the price covers this many people; each extra pays extra_guest_fee. */
    capacity: number;
    /** Most people one booking may bring: capacity, or more when extras pay. */
    max_guests: number;
    rental_price: string | null;
    extra_guest_fee: string | null;
    photos: string[] | null;
  }[];
  movies: CinemaMovie[];
}

interface SlotSeat {
  id: number;
  label: string;
  row_label: string;
  seat_type: string;
  capacity: number;
  price_modifier: string;
  availability: "available" | "reserved" | "disabled";
}

interface Slot {
  room: { capacity: number; photos: string[] | null };
  start: string;
  end: string;
  price: string;
  available: boolean;
  message: string | null;
  busy: { start: string; end: string }[];
  seats: SlotSeat[];
}

const ZONE = "Asia/Manila";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONE });
const nowClock = () => new Date().toLocaleTimeString("en-GB", { timeZone: ZONE, hour12: false }).slice(0, 5);

/** The next seven days as YYYY-MM-DD, starting today in Manila. */
const nextDays = (from: string) =>
  Array.from({ length: 7 }, (_, i) => {
    const day = new Date(`${from}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });

const dayParts = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`);
  return {
    weekday: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    number: day.getUTCDate(),
    long: day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
  };
};

/** "2026-11-03 21:00" → "9:00 PM" */
const clockOf = (dateTime: string) => formatClock(dateTime.slice(11));

const peso = (amount: number | string) => `₱${Number(amount).toFixed(2)}`;

/**
 * Mini cinema booking: the movie comes from the poster tapped, then the
 * customer picks a room, a day and a start time. The booking lasts the
 * movie's runtime; by seat they also pick seats.
 */
const RoomBooking: React.FC = () => {
  const ionRouter = useIonRouter();
  const [params] = useSearchParams();
  const branchId = params.get("branch");
  const movieParam = params.get("movie") ?? "";
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [form, setForm] = useState({ movie: movieParam, room: "", date: today(), time: "" });
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [seatIds, setSeatIds] = useState<number[]>([]);
  // Party size by room; null = the room's default (its included number).
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  // Ionic reuses this view, so reload whenever the cinema in the URL changes.
  useEffect(() => {
    if (!branchId) return;
    setCinema(null);
    setError(null);
    apiGetAuth<Cinema>(`/public/branches/${branchId}`)
      .then(setCinema)
      .catch(() => setError("This cinema isn't taking bookings right now."));
  }, [branchId]);

  // Same reuse: a new movie or cinema in the URL starts a fresh booking
  // instead of keeping the previous visit's picks.
  useEffect(() => {
    setForm({ movie: movieParam, room: "", date: today(), time: "" });
  }, [branchId, movieParam]);

  // Quote the slot as soon as everything is picked.
  useEffect(() => {
    setSlot(null);
    setSlotError(null);
    setSeatIds([]);
    if (!form.movie || !form.room || !form.date || !form.time) return;
    const query = new URLSearchParams({ movie_id: form.movie, date: form.date, start_time: form.time });
    apiGetAuth<Slot>(`/customer/rooms/${form.room}/slot?${query}`)
      .then(setSlot)
      .catch((err: { message?: string }) => setSlotError(err.message ?? "Unable to check this time."));
  }, [form]);

  const movie = cinema?.movies.find((m) => String(m.id) === form.movie) ?? null;
  const room = cinema?.rooms.find((r) => String(r.id) === form.room) ?? null;
  const seatMode = cinema?.branch.booking_mode === "seat";
  const days = nextDays(today());
  // Today only offers times that haven't started yet.
  const times =
    cinema?.branch.operating_hours && movie
      ? startTimes(cinema.branch.operating_hours, form.date, movie.duration_minutes).filter(
          (time) => form.date !== today() || time > nowClock()
        )
      : [];

  const seatPrice = (seat: SlotSeat) => Number(slot?.price ?? 0) + Number(seat.price_modifier);
  const extraPricing = !seatMode && room?.extra_guest_fee != null;
  const guests = room ? Math.min(guestCount ?? 1, room.max_guests) : 1;
  const extraGuests = extraPricing ? Math.max(0, guests - room!.capacity) : 0;
  const extraCharge = extraGuests * Number(room?.extra_guest_fee ?? 0);
  const total = seatMode
    ? (slot?.seats ?? []).filter((seat) => seatIds.includes(seat.id)).reduce((sum, seat) => sum + seatPrice(seat), 0)
    : Number(slot?.price ?? room?.rental_price ?? 0) + extraCharge;
  const canBook = Boolean(slot?.available) && (!seatMode || seatIds.length > 0) && !booking;

  const book = async () => {
    if (!canBook) return;
    setBooking(true);
    setError(null);
    try {
      const res = await apiPostAuth<{ reservation: { id: number } }>("/customer/bookings", {
        screen_id: Number(form.room),
        movie_id: Number(form.movie),
        date: form.date,
        start_time: form.time,
        ...(seatMode ? { seat_ids: seatIds } : { guests }),
      });
      navigate(ionRouter, `/booking/payment?reservation=${res.reservation.id}`);
    } catch (err) {
      setError((err as { message?: string }).message ?? "Unable to book. Please try again.");
      setForm((f) => ({ ...f })); // re-quote: someone may have just taken it
    } finally {
      setBooking(false);
    }
  };

  const pick = (changes: Partial<typeof form>) => setForm((f) => ({ ...f, ...changes }));

  const rows = (slot?.seats ?? []).reduce<Record<string, SlotSeat[]>>((acc, seat) => {
    (acc[seat.row_label] ??= []).push(seat);
    return acc;
  }, {});

  const poster = resolveStorageUrl(movie?.poster_url ?? null);
  const summary = [room?.name, form.time && `${dayParts(form.date).long}, ${formatClock(form.time)}`]
    .filter(Boolean)
    .join(" · ");
  const bookLabel = seatMode
    ? seatIds.length
      ? `Book ${seatIds.length} seat${seatIds.length === 1 ? "" : "s"}`
      : "Pick seats"
    : "Book room";

  return (
    <IonPage>
      <div className="cinemas-page">
        <header className="cinemas-header">
          <button
            type="button"
            className="cinemas-header__back"
            aria-label="Back"
            onClick={() => navigate(ionRouter, "/movies")}
          >
            <IonIcon icon={arrowBackOutline} />
          </button>
          <h1 className="cinemas-header__title">{cinema?.branch.name ?? "Book"}</h1>
        </header>

        <IonContent scrollY className="cinemas-content">
          <div className="cinemas-body booking">
            {!cinema ? (
              error ? (
                <p className="cinemas-empty">{error}</p>
              ) : (
                <div className="cinemas-empty">
                  <IonSpinner name="dots" />
                </div>
              )
            ) : (
              <>
                {movie && movieParam ? (
                  <section className="booking-hero">
                    {poster && <div className="booking-hero__backdrop" style={{ backgroundImage: `url(${poster})` }} />}
                    <div className="booking-hero__poster">
                      {poster ? <img src={poster} alt="" /> : <IonIcon icon={filmOutline} />}
                    </div>
                    <div className="booking-hero__info">
                      <h2>{movie.title}</h2>
                      <p>
                        {formatRuntime(movie.duration_minutes)}
                        {movie.age_rating && <span className="booking-hero__rating">{movie.age_rating}</span>}
                      </p>
                      {movie.genres.length > 0 && <p className="booking-hero__genres">{movie.genres.join(", ")}</p>}
                    </div>
                  </section>
                ) : (
                  // Only a bare link (no movie tapped) asks for one.
                  <label className="booking-step booking-movie">
                    <span className="booking-step__title">Movie</span>
                    <select value={form.movie} onChange={(e) => pick({ movie: e.target.value, time: "" })}>
                      <option value="">Choose a movie</option>
                      {cinema.movies.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({formatRuntime(m.duration_minutes)})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <section className="booking-step" aria-label="Room">
                  <h3 className="booking-step__title">Room</h3>
                  <div className="booking-rooms" role="radiogroup" aria-label="Room">
                    {cinema.rooms.map((r) => {
                      const photo = resolveStorageUrl(r.photos?.[0] ?? null);
                      const selected = form.room === String(r.id);
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          key={r.id}
                          className={`booking-room${selected ? " booking-room--selected" : ""}`}
                          onClick={() => {
                            pick({ room: String(r.id) });
                            setGuestCount(null);
                          }}
                        >
                          <span className="booking-room__photo">
                            {photo ? <img src={photo} alt="" /> : <IonIcon icon={filmOutline} />}
                          </span>
                          <span className="booking-room__info">
                            <strong>{r.name}</strong>
                            <small>
                              <IonIcon icon={peopleOutline} />{" "}
                              {!seatMode && r.extra_guest_fee != null ? `Covers ${r.capacity}` : `Up to ${r.capacity}`}
                            </small>
                            {!seatMode && r.extra_guest_fee != null && (
                              <small>Additional Person: {peso(r.extra_guest_fee)}</small>
                            )}
                          </span>
                          {r.rental_price && (
                            <span className="booking-room__price">
                              {peso(r.rental_price)}
                              <small>{seatMode ? "per seat" : "per movie"}</small>
                            </span>
                          )}
                          {selected && <IonIcon className="booking-room__check" icon={checkmarkCircle} />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {!seatMode && room && (
                  <section className="booking-step" aria-label="Guests">
                    <h3 className="booking-step__title">How many people?</h3>
                    <div className="booking-guests">
                      <button
                        type="button"
                        aria-label="Fewer people"
                        disabled={guests <= 1}
                        onClick={() => setGuestCount(guests - 1)}
                      >
                        <IonIcon icon={removeOutline} />
                      </button>
                      <strong aria-live="polite">
                        {guests} {guests === 1 ? "person" : "people"}
                      </strong>
                      <button
                        type="button"
                        aria-label="More people"
                        disabled={guests >= room.max_guests}
                        onClick={() => setGuestCount(guests + 1)}
                      >
                        <IonIcon icon={addOutline} />
                      </button>
                    </div>
                    {extraPricing && (
                      <p className={`booking-note${extraGuests > 0 ? " booking-note--ok" : ""}`}>
                        {extraGuests > 0
                          ? `Additional Person: ${peso(room.extra_guest_fee!)} × ${extraGuests} = +${peso(extraCharge)}`
                          : `The room price covers up to ${room.capacity} ${room.capacity === 1 ? "person" : "people"}. Additional Person: ${peso(room.extra_guest_fee!)}`}
                      </p>
                    )}
                  </section>
                )}

                <section className="booking-step" aria-label="Day">
                  <h3 className="booking-step__title">Day</h3>
                  <div className="booking-days">
                    {days.map((date, i) => {
                      const { weekday, number } = dayParts(date);
                      const selected = form.date === date;
                      return (
                        <button
                          type="button"
                          key={date}
                          aria-pressed={selected}
                          className={`booking-day${selected ? " booking-day--selected" : ""}`}
                          onClick={() => pick({ date, time: "" })}
                        >
                          <small>{i === 0 ? "Today" : weekday}</small>
                          <strong>{number}</strong>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="booking-step" aria-label="Start time">
                  <h3 className="booking-step__title">Start time</h3>
                  {!movie ? (
                    <p className="booking-note">Choose a movie to see start times.</p>
                  ) : times.length === 0 ? (
                    <p className="booking-note">No start times left on this day. Try another day.</p>
                  ) : (
                    <div className="booking-times">
                      {times.map((time) => {
                        const selected = form.time === time;
                        return (
                          <button
                            type="button"
                            key={time}
                            aria-pressed={selected}
                            className={`booking-time${selected ? " booking-time--selected" : ""}`}
                            onClick={() => pick({ time })}
                          >
                            {formatClock(time)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {form.time && !form.room && <p className="booking-note">Choose a room to check this time.</p>}
                  {slotError && <p className="room-error">{slotError}</p>}
                  {slot &&
                    (slot.available ? (
                      <p className="booking-note booking-note--ok">
                        Ends at {clockOf(slot.end)}
                      </p>
                    ) : (
                      <p className="room-error">{slot.message}</p>
                    ))}
                  {slot && slot.busy.length > 0 && (
                    <p className="booking-note">
                      Already booked: {slot.busy.map((b) => `${clockOf(b.start)}–${clockOf(b.end)}`).join(", ")}
                    </p>
                  )}
                </section>

                {seatMode && slot?.available && (
                  <section className="booking-step" aria-label="Seats">
                    <h3 className="booking-step__title">Seats</h3>
                    <div className="booking-seats">
                      {Object.entries(rows).map(([row, seats]) => (
                        <div key={row} className="booking-seats__row">
                          <span>{row}</span>
                          {seats.map((seat) => {
                            const selected = seatIds.includes(seat.id);
                            return (
                              <button
                                type="button"
                                key={seat.id}
                                disabled={seat.availability !== "available"}
                                aria-pressed={selected}
                                className={`booking-seat${selected ? " booking-seat--selected" : ""}${seat.seat_type === "bench" ? " booking-seat--bench" : ""}`}
                                onClick={() =>
                                  setSeatIds((ids) => (selected ? ids.filter((id) => id !== seat.id) : [...ids, seat.id]))
                                }
                              >
                                {seat.label}
                                {seat.seat_type === "bench" && ` ×${seat.capacity}`}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {error && <p className="room-error">{error}</p>}
              </>
            )}
          </div>
        </IonContent>

        {cinema && (
          <footer className="booking-bar">
            <div className="booking-bar__summary">
              <small>{summary || "Pick a room and a time"}</small>
              <strong>{peso(total)}</strong>
            </div>
            <button type="button" className="room-footer__book" disabled={!canBook} onClick={book}>
              {booking ? <IonSpinner name="dots" /> : bookLabel}
            </button>
          </footer>
        )}
      </div>
    </IonPage>
  );
};

export default RoomBooking;
