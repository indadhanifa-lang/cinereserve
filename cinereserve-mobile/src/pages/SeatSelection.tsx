import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  useIonRouter,
  useIonViewWillEnter,
} from "@ionic/react";
import { useSearchParams } from "react-router-dom";
import {
  alertCircleOutline,
  arrowBackOutline,
  closeOutline,
  filmOutline,
} from "ionicons/icons";
import { apiGetAuth, apiPostAuth } from "../lib/api";
import { navigate } from "../lib/nav";
import "./SeatSelection.css";

type Availability = "available" | "reserved" | "disabled";

interface SeatDto {
  id: number;
  label: string;
  row_label: string;
  seat_number: number;
  seat_type: string;
  price_modifier: string;
  availability: Availability;
}

interface ScheduleInfo {
  id: number;
  movie: { id: number | null; title: string | null };
  branch: { id: number | null; name: string | null };
  screen: { id: number | null; name: string | null };
  show_date: string;
  start_time: string;
  end_time: string;
  ticket_price: string;
}

interface SeatsResponse {
  schedule: ScheduleInfo;
  seats: SeatDto[];
}

type LoadError = { kind: "unavailable" | "failed"; message: string } | null;

interface CreatedReservation {
  id: number;
  reservation_code: string;
  status: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  expires_at: string | null;
  movie: { title: string | null };
  branch: { name: string | null };
  screen: { name: string | null };
  show_date: string;
  start_time: string;
  seats: { id: number; label: string; price: string }[];
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === "object") {
    const apiError = error as { message?: string; errors?: Record<string, string[]> };
    const firstError = apiError.errors ? Object.values(apiError.errors)[0] : undefined;
    if (firstError && firstError[0]) return firstError[0];
    if (apiError.message) return apiError.message;
  }
  return fallback;
};

/** HH:MM:SS (or HH:MM) → "8:00 AM" */
const formatTime = (time: string): string => {
  const [rawHours, minutes] = time.split(":").map(Number);
  const hours = rawHours ?? 0;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, "0")} ${period}`;
};

/** show_date (YYYY-MM-DD) → "Oct 5, 2026". Date object used only for
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

/** 250 or "250.00" → "₱250.00" (display only — backend recomputes later) */
const formatPrice = (value: number): string => `₱${value.toFixed(2)}`;

/** +50 → "+₱50.00"; -50 → "-₱50.00" (breakdown rows) */
const formatSignedPrice = (value: number): string =>
  `${value > 0 ? "+" : "-"}₱${Math.abs(value).toFixed(2)}`;

/** Compact seat-grid tag: "+₱50" / "-₱50" (whole pesos drop decimals) */
const formatModifierTag = (value: number): string => {
  const abs = Math.abs(value);
  const amount = Number.isInteger(abs) ? abs : abs.toFixed(2);
  return `${value > 0 ? "+" : "-"}₱${amount}`;
};

const SeatSelection: React.FC = () => {
  const ionRouter = useIonRouter();
  const [searchParams] = useSearchParams();

  // Only the schedule id comes from the URL; everything else is resolved
  // by the backend. Missing/garbage/zero → local error state, no request.
  const rawSchedule = searchParams.get("schedule");
  const scheduleId =
    rawSchedule !== null && /^\d+$/.test(rawSchedule) && Number(rawSchedule) > 0
      ? Number(rawSchedule)
      : null;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SeatsResponse | null>(null);
  const [error, setError] = useState<LoadError>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedReservation | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastSubtitle, setToastSubtitle] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: only the newest request may write state, so a slow
  // response for a previously selected schedule can never repaint after
  // this schedule's purge (wrong movie/screen flash) or hide its spinner.
  const requestRef = useRef(0);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  const loadSeats = useCallback(async () => {
    const requestId = ++requestRef.current;

    if (!scheduleId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await apiGetAuth<SeatsResponse>(
        `/customer/schedules/${scheduleId}/seats`
      );
      if (requestId !== requestRef.current) return;
      setData(response);
      setError(null);
      // Refresh on re-entry: drop selections whose seat is no longer
      // available (someone booked it while we were away).
      setSelectedIds((previous) =>
        previous.filter((id) =>
          response.seats.some((seat) => seat.id === id && seat.availability === "available")
        )
      );
      setShowSummary(false);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setData(null);
      setSelectedIds([]);
      const status = (err as { status?: number }).status;
      if (status === 404) {
        setError({ kind: "unavailable", message: "Showtime not found." });
      } else if (status === 409) {
        setError({ kind: "unavailable", message: "This showtime is no longer available." });
      } else {
        const message = getErrorMessage(err, "Please try again later.");
        setError({ kind: "failed", message });
        // Toast + inline Retry; token is never cleared on failure.
        showToastMessage("Unable to load seats", message);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [scheduleId, showToastMessage]);

  // The lifecycle callback below is registered ONCE by @ionic/react
  // (empty deps), and Ionic reuses this view instance for every
  // /booking/seats push. Calling through the ref guarantees the handler
  // always runs the latest loadSeats — i.e. the schedule id currently in
  // the URL — instead of the first-mount closure, which used to fetch the
  // previously opened schedule (wrong movie/screen/seats).
  const loadRef = useRef(loadSeats);
  loadRef.current = loadSeats;

  // Schedule changed (Movies → schedule A → back → schedule B): purge
  // everything belonging to A before B's fetch resolves, so previous
  // movie/screen details never flash, old selections never carry over,
  // and the summary modal cannot stay open across schedules. Loading is
  // forced only while a valid id exists; an invalid link falls straight
  // to its error state.
  useEffect(() => {
    setData(null);
    setError(null);
    setSelectedIds([]);
    setShowSummary(false);
    setSubmitting(false);
    setCreated(null);
    setLoading(scheduleId !== null);
  }, [scheduleId]);

  useIonViewWillEnter(() => {
    // Returning from Movies must never resurrect a stale success modal;
    // the created reservation lives only until the view is left.
    setCreated(null);
    void loadRef.current();
  });

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Backend returns seats ordered by row_label then seat_number; grouping
  // preserves that order — rows/columns are never hardcoded.
  const rows = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, SeatDto[]>();
    for (const seat of data.seats) {
      const list = grouped.get(seat.row_label) ?? [];
      list.push(seat);
      grouped.set(seat.row_label, list);
    }
    return Array.from(grouped.entries()).map(([label, seats]) => ({ label, seats }));
  }, [data]);

  const seatPrice = useCallback(
    (seat: SeatDto): number => {
      if (!data) return 0;
      return Number(data.schedule.ticket_price) + Number(seat.price_modifier);
    },
    [data]
  );

  // Schedule base ticket price — the foundation of every breakdown line.
  const basePrice = data ? Number(data.schedule.ticket_price) : 0;

  const selectedSeats = useMemo(
    () => (data ? data.seats.filter((seat) => selectedIds.includes(seat.id)) : []),
    [data, selectedIds]
  );
  const totalPrice = selectedSeats.reduce((sum, seat) => sum + seatPrice(seat), 0);
  // Aggregate seat premium/discount across the selection (display only —
  // the backend is always the source of truth for charged amounts).
  const totalModifier = selectedSeats.reduce(
    (sum, seat) => sum + Number(seat.price_modifier),
    0
  );
  const hasMixedModifiers =
    selectedSeats.some((seat) => Number(seat.price_modifier) > 0) &&
    selectedSeats.some((seat) => Number(seat.price_modifier) < 0);

  /** Aggregate row label: hidden at 0, "Seat Adjustments" when positive
   * and negative modifiers coexist, otherwise Premium/Discount. */
  const aggregateModifierLabel = (): string | null => {
    if (totalModifier === 0) return null;
    if (hasMixedModifiers) return "Seat Adjustments";
    return totalModifier > 0 ? "Seat Premium" : "Seat Discount";
  };

  const toggleSeat = (seat: SeatDto) => {
    if (seat.availability !== "available") return;
    setSelectedIds((previous) =>
      previous.includes(seat.id)
        ? previous.filter((id) => id !== seat.id)
        : [...previous, seat.id]
    );
  };

  // POST only schedule_id + seat_ids — everything else is computed by the
  // backend. Single in-flight request: submitting guard blocks double taps.
  const confirmReservation = useCallback(async () => {
    if (!scheduleId || submitting || selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      const response = await apiPostAuth<{ reservation: CreatedReservation }>(
        "/customer/reservations",
        { schedule_id: scheduleId, seat_ids: selectedIds }
      );
      setShowSummary(false);
      setCreated(response.reservation);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const unavailableIds = (err as { unavailable_seat_ids?: number[] })
        .unavailable_seat_ids;

      if (status === 409 && Array.isArray(unavailableIds) && unavailableIds.length > 0) {
        // Seat conflict: nothing was created. Close the summary, tell the
        // customer, reload — loadSeats prunes the taken seats.
        setShowSummary(false);
        showToastMessage(
          "Seats unavailable",
          "One or more seats are no longer available."
        );
        void loadRef.current();
      } else if (status === 409) {
        // Showtime closed while deciding: error card + Back to Movies.
        setShowSummary(false);
        setData(null);
        setSelectedIds([]);
        setError({
          kind: "unavailable",
          message:
            (err as { message?: string }).message ||
            "This showtime is no longer available.",
        });
        setLoading(false);
      } else if (status === 422) {
        showToastMessage(
          "Unable to create reservation",
          getErrorMessage(err, "One or more selected seats are invalid.")
        );
        void loadRef.current();
      } else {
        // Unknown failure: keep the summary open for a retry, never fake
        // a success.
        showToastMessage(
          "Unable to create reservation",
          getErrorMessage(err, "Please try again later.")
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [scheduleId, submitting, selectedIds, showToastMessage]);

  const goBackToMovies = () => navigate(ionRouter, "/movies");

  const renderErrorCard = (message: string, canRetry: boolean) => (
    <div className="seat-error">
      <div className="seat-error__icon">
        <IonIcon icon={alertCircleOutline} />
      </div>
      <h2 className="seat-error__title">Unable to Load Seats</h2>
      <p className="seat-error__text">{message}</p>
      <div className="seat-error__actions">
        {canRetry && (
          <button type="button" className="seat-error__retry" onClick={() => void loadSeats()}>
            Retry
          </button>
        )}
        <button type="button" className="seat-error__back" onClick={goBackToMovies}>
          Back to Movies
        </button>
      </div>
    </div>
  );

  const schedule = data?.schedule ?? null;
  const place = schedule
    ? [schedule.branch?.name ?? "Cinema", schedule.screen?.name ?? null].filter(Boolean).join(" • ")
    : "";

  return (
    <IonPage>
      <div className="seat-page">
        <header className="seat-header">
          <button
            type="button"
            className="seat-header__back"
            aria-label="Back to movies"
            onClick={goBackToMovies}
          >
            <IonIcon icon={arrowBackOutline} />
          </button>
          <div className="seat-header__titles">
            <h1 className="seat-header__title">Select Your Seats</h1>
            {schedule && <span className="seat-header__movie">{schedule.movie?.title ?? "Movie"}</span>}
          </div>
        </header>

        <IonContent scrollY className="seat-content">
          <div className="seat-body">
            {scheduleId === null ? (
              renderErrorCard(
                "This seat selection link is invalid or incomplete. Please pick a showtime again.",
                false
              )
            ) : loading ? (
              <div className="seat-loading">
                <IonSpinner name="crescent" />
              </div>
            ) : error ? (
              renderErrorCard(error.message, error.kind === "failed")
            ) : data && schedule ? (
              <>
                <section className="seat-info">
                  <div className="seat-info__place">{place}</div>
                  <div className="seat-info__date">{formatDate(schedule.show_date)}</div>
                  <div className="seat-info__time">
                    {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                  </div>
                </section>

                <div className="seat-screen">
                  <span className="seat-screen__label">SCREEN</span>
                  <span className="seat-screen__bar" aria-hidden="true" />
                </div>

                <div className="seat-rows-scroll">
                  <div className="seat-rows">
                    {rows.map((row) => (
                      <div className="seat-row" key={row.label}>
                        <span className="seat-row__label">{row.label}</span>
                        {row.seats.map((seat) => {
                          const isSelected =
                            seat.availability === "available" && selectedIds.includes(seat.id);
                          const modifier = Number(seat.price_modifier);
                          const stateClass = isSelected
                            ? " seat--selected"
                            : seat.availability === "reserved"
                              ? " seat--reserved"
                              : seat.availability === "disabled"
                                ? " seat--disabled"
                                : "";
                          // Informational micro-line only for non-zero
                          // modifiers — "+₱0" is never shown. State
                          // styling always wins over the premium accent.
                          const premiumClass = modifier !== 0 ? " seat--premium" : "";
                          return (
                            <button
                              type="button"
                              key={seat.id}
                              className={`seat${stateClass}${premiumClass}`}
                              disabled={seat.availability !== "available"}
                              aria-pressed={isSelected}
                              aria-label={`Seat ${seat.label}${
                                modifier !== 0
                                  ? `, ${modifier > 0 ? "premium" : "discounted"}`
                                  : ""
                              }${
                                seat.availability === "available"
                                  ? isSelected
                                    ? ", selected"
                                    : ", available"
                                  : seat.availability === "reserved"
                                    ? ", reserved"
                                    : ", unavailable"
                              }`}
                              onClick={() => toggleSeat(seat)}
                            >
                              <span className="seat__label">{seat.label}</span>
                              {modifier !== 0 && (
                                <span className="seat__premium-tag">
                                  {formatModifierTag(modifier)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="seat-legend">
                  <span className="seat-legend__item seat-legend__item--available">Available</span>
                  <span className="seat-legend__item seat-legend__item--selected">Selected</span>
                  <span className="seat-legend__item seat-legend__item--reserved">Reserved</span>
                  <span className="seat-legend__item seat-legend__item--disabled">Unavailable</span>
                </div>
                <p className="seat-legend__note">
                  Some seats may include an additional seat premium.
                </p>

                <section className="seat-summary">
                  <div className="seat-summary__label">Selected Seats</div>
                  {selectedSeats.length > 0 ? (
                    <div className="seat-summary__list">
                      {selectedSeats.map((seat) => {
                        const modifier = Number(seat.price_modifier);
                        // Zero modifier → single simple line, no +₱0 noise.
                        if (modifier === 0) {
                          return (
                            <div className="seat-summary__row" key={seat.id}>
                              <span>{seat.label}</span>
                              <span>{formatPrice(seatPrice(seat))}</span>
                            </div>
                          );
                        }
                        return (
                          <div className="seat-summary__breakdown" key={seat.id}>
                            <div className="seat-summary__seat-name">{seat.label}</div>
                            <div className="seat-summary__detail-row">
                              <span>Base Ticket</span>
                              <span>{formatPrice(basePrice)}</span>
                            </div>
                            <div className="seat-summary__detail-row seat-summary__detail-row--adjust">
                              <span>{modifier > 0 ? "Seat Premium" : "Seat Discount"}</span>
                              <span>{formatSignedPrice(modifier)}</span>
                            </div>
                            <div className="seat-summary__detail-row seat-summary__detail-row--seat-total">
                              <span>Seat Total</span>
                              <span>{formatPrice(seatPrice(seat))}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="seat-summary__row seat-summary__row--total">
                        <span>Booking Total</span>
                        <span>{formatPrice(totalPrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="seat-summary__empty">No seats selected yet.</div>
                  )}
                </section>

                <div className="seat-footer">
                  <div className="seat-footer__info">
                    <span className="seat-footer__count">
                      {selectedSeats.length} Seat{selectedSeats.length === 1 ? "" : "s"} Selected
                    </span>
                    <span className="seat-footer__total">Total: {formatPrice(totalPrice)}</span>
                  </div>
                  <button
                    type="button"
                    className="seat-footer__continue"
                    disabled={selectedSeats.length === 0}
                    onClick={() => setShowSummary(true)}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </IonContent>

        {showSummary && data && schedule && (
          <div
            className="seat-modal"
            onClick={() => {
              if (!submitting) setShowSummary(false);
            }}
          >
            <div className="seat-modal__backdrop" />
            <div
              className="seat-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Booking summary"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="seat-modal__header">
                <h2 className="seat-modal__title">Booking Summary</h2>
                <button
                  type="button"
                  className="seat-modal__close"
                  aria-label="Close"
                  disabled={submitting}
                  onClick={() => setShowSummary(false)}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="seat-modal__scroll">
                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Movie</span>
                  <div className="seat-modal__movie">
                    <IonIcon icon={filmOutline} className="seat-modal__movie-icon" />
                    <strong>{schedule.movie?.title ?? "Untitled movie"}</strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Cinema</span>
                  <div className="seat-modal__row">
                    <span>Branch • Screen</span>
                    <strong>{place}</strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Showtime</span>
                  <div className="seat-modal__row">
                    <span>Show Date</span>
                    <strong>{formatDate(schedule.show_date)}</strong>
                  </div>
                  <div className="seat-modal__row">
                    <span>Time</span>
                    <strong>
                      {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                    </strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Selected Seats</span>
                  {selectedSeats.map((seat) => {
                    const modifier = Number(seat.price_modifier);
                    if (modifier === 0) {
                      return (
                        <div className="seat-modal__row" key={seat.id}>
                          <span>{seat.label}</span>
                          <strong>{formatPrice(seatPrice(seat))}</strong>
                        </div>
                      );
                    }
                    return (
                      <div className="seat-modal__breakdown" key={seat.id}>
                        <div className="seat-modal__breakdown-name">{seat.label}</div>
                        <div className="seat-modal__row">
                          <span>Base Ticket</span>
                          <strong>{formatPrice(basePrice)}</strong>
                        </div>
                        <div className="seat-modal__row seat-modal__row--adjust">
                          <span>{modifier > 0 ? "Seat Premium" : "Seat Discount"}</span>
                          <strong>{formatSignedPrice(modifier)}</strong>
                        </div>
                        <div className="seat-modal__row seat-modal__row--seat-total">
                          <span>Seat Total</span>
                          <strong>{formatPrice(seatPrice(seat))}</strong>
                        </div>
                      </div>
                    );
                  })}
                  <div className="seat-modal__row">
                    <span>Ticket Price</span>
                    <strong>{formatPrice(basePrice * selectedSeats.length)}</strong>
                  </div>
                  {aggregateModifierLabel() !== null && (
                    <div className="seat-modal__row seat-modal__row--adjust">
                      <span>{aggregateModifierLabel()}</span>
                      <strong>{formatSignedPrice(totalModifier)}</strong>
                    </div>
                  )}
                  <div className="seat-modal__row seat-modal__row--total">
                    <span>Total</span>
                    <strong>{formatPrice(totalPrice)}</strong>
                  </div>
                </div>
              </div>

              <div className="seat-modal__actions">
                <button
                  type="button"
                  className="seat-modal__back"
                  disabled={submitting}
                  onClick={() => setShowSummary(false)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={`seat-modal__confirm${
                    submitting ? " seat-modal__confirm--busy" : ""
                  }`}
                  disabled={submitting}
                  onClick={() => void confirmReservation()}
                >
                  {submitting ? (
                    <span className="seat-modal__confirm-spinner">
                      <IonSpinner name="crescent" />
                      Creating Reservation…
                    </span>
                  ) : (
                    "Confirm Reservation"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {created && (
          <div className="seat-modal">
            <div className="seat-modal__backdrop" />
            <div
              className="seat-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Reservation created"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="seat-modal__header">
                <h2 className="seat-modal__title">Reservation Created</h2>
              </div>

              <div className="seat-modal__scroll">
                <div className="seat-success__code">{created.reservation_code}</div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Movie</span>
                  <div className="seat-modal__movie">
                    <IonIcon icon={filmOutline} className="seat-modal__movie-icon" />
                    <strong>{created.movie?.title ?? "Untitled movie"}</strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Cinema</span>
                  <div className="seat-modal__row">
                    <span>Branch • Screen</span>
                    <strong>
                      {[created.branch?.name ?? "Cinema", created.screen?.name ?? null]
                        .filter(Boolean)
                        .join(" • ")}
                    </strong>
                  </div>
                  <div className="seat-modal__row">
                    <span>Showtime</span>
                    <strong>
                      {formatDate(created.show_date)} • {formatTime(created.start_time)}
                    </strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <span className="seat-modal__section-label">Seats</span>
                  <div className="seat-modal__row">
                    <span>{created.seats.map((seat) => seat.label).join(", ")}</span>
                    <strong>{formatPrice(Number(created.total_amount))}</strong>
                  </div>
                </div>

                <div className="seat-modal__section">
                  <div className="seat-modal__row seat-modal__row--total">
                    <span>Total</span>
                    <strong>{formatPrice(Number(created.total_amount))}</strong>
                  </div>
                  <div className="seat-modal__row">
                    <span>Status</span>
                    <strong className="seat-success__status">Pending</strong>
                  </div>
                </div>

                <p className="seat-success__hold">
                  Seat hold expires in approximately 10 minutes.
                </p>
              </div>

              <div className="seat-modal__actions">
                <button
                  type="button"
                  className="seat-modal__confirm"
                  onClick={() =>
                    navigate(ionRouter, `/booking/payment?reservation=${created.id}`)
                  }
                >
                  Continue to Payment
                </button>
                <button type="button" className="seat-modal__back" onClick={goBackToMovies}>
                  Back to Movies
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`seat-toast ${showToast ? "seat-toast--visible" : ""}`}>
          <div className="seat-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="seat-toast__text">
            <span className="seat-toast__title">{toastTitle}</span>
            <span className="seat-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default SeatSelection;
