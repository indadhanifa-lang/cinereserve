import { useCallback, useEffect, useRef, useState } from "react";
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
  cardOutline,
  checkmarkCircleOutline,
  closeOutline,
  filmOutline,
  timeOutline,
  walletOutline,
} from "ionicons/icons";
import { apiGetAuth, apiPostAuth } from "../lib/api";
import { navigate } from "../lib/nav";
import "./Payment.css";

interface PaymentSummary {
  reservation: {
    id: number;
    reservation_code: string;
    status: string;
    subtotal: string;
    discount_amount: string;
    total_amount: string;
    expires_at: string | null;
    expires_in_seconds?: number | null;
    schedule_id: number | null;
    movie: { title: string | null };
    branch: { name: string | null };
    screen: { name: string | null };
    show_date: string | null;
    start_time: string | null;
    seats: { label: string; price: string }[];
  };
}

interface PayResponse {
  payment: {
    id: number;
    payment_reference: string;
    payment_method: string;
    amount: string;
    status: string;
    paid_at: string | null;
  };
  reservation: {
    id: number;
    reservation_code: string;
    status: string;
    total_amount: string;
  };
  ticket: {
    id: number;
    ticket_code: string;
    status: string;
  };
}

type LoadErrorKind = "invalid" | "notfound" | "expired" | "notpayable" | "failed";
type LoadError = { kind: LoadErrorKind; message: string } | null;

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

type PaymentMethod = "gcash" | "card";

// Demo: the choice is recorded with the payment, but no real charge is made.
const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint: string; icon: string }[] = [
  { value: "gcash", label: "GCash", hint: "Pay with your GCash wallet", icon: walletOutline },
  { value: "card", label: "Credit / Debit Card", hint: "Visa, Mastercard", icon: cardOutline },
];

/** Stored payment_method → display label ("gcash" → "GCash"). */
const formatMethod = (value: string): string =>
  PAYMENT_METHODS.find((option) => option.value === value)?.label ??
  (value === "mock" ? "Mock Payment" : "Payment");

/** 522000 ms → "8:42" */
const formatHoldRemaining = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** "250.00" → "₱250.00" — display only; totals always come from the backend. */
const formatPrice = (value: string): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

/** Backend status value ("confirmed" / "valid") → "Confirmed" / "Valid".
 * Presentation capitalization only — the value itself always comes from
 * the response, never hardcoded. */
const formatStatus = (status: string): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

const Payment: React.FC = () => {
  const ionRouter = useIonRouter();
  const [searchParams] = useSearchParams();

  // Only the reservation id comes from the URL; amount, ownership, status
  // and reference are all resolved by the backend. Missing/garbage/zero →
  // local error state, no request.
  const rawReservation = searchParams.get("reservation");
  const reservationId =
    rawReservation !== null && /^\d+$/.test(rawReservation) && Number(rawReservation) > 0
      ? Number(rawReservation)
      : null;

  const [loading, setLoading] = useState(reservationId !== null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<LoadError>(
    reservationId === null
      ? {
          kind: "invalid",
          message: "This payment link is invalid or incomplete. Please pick a showtime again.",
        }
      : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [paid, setPaid] = useState<PayResponse | null>(null);
  // Closing the modal keeps `paid`, so the page stays in its paid state.
  const [successOpen, setSuccessOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  // Hold deadline on the device clock, derived from the server's
  // seconds-remaining so a wrong phone clock can't shift the countdown.
  const [holdDeadline, setHoldDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState("");
  const [toastSubtitle, setToastSubtitle] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id: only the newest request may write state, so a slow
  // response can never repaint stale data over a newer one.
  const requestRef = useRef(0);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  const loadPayment = useCallback(async () => {
    if (reservationId === null) {
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await apiGetAuth<PaymentSummary>(
        `/customer/reservations/${reservationId}/payment`
      );
      if (requestId !== requestRef.current) return;
      setSummary(response);
      const seconds = response.reservation.expires_in_seconds;
      setNow(Date.now());
      setHoldDeadline(typeof seconds === "number" ? Date.now() + seconds * 1000 : null);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      const status = (err as { status?: number }).status;
      const message = getErrorMessage(err, "Please try again later.");
      if (status === 404) {
        setError({ kind: "notfound", message: "Reservation not found." });
      } else if (status === 409 && /expired/i.test(message)) {
        setError({
          kind: "expired",
          message: "Your seat hold has expired. Please choose your seats again.",
        });
      } else if (status === 409) {
        setError({ kind: "notpayable", message });
      } else {
        // Toast + inline Retry; token is never cleared on failure.
        setError({ kind: "failed", message });
        showToastMessage("Unable to load payment", message);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [reservationId, showToastMessage]);

  // Registered ONCE; the ref guarantees the latest loader (current URL id)
  // runs on every view entry instead of a first-mount closure.
  const loadRef = useRef(loadPayment);
  loadRef.current = loadPayment;

  useIonViewWillEnter(() => {
    // Re-entering must never resurrect a stale success modal.
    setPaid(null);
    setSuccessOpen(false);
    setHoldDeadline(null);
    setSummary(null);
    setSubmitting(false);
    void loadRef.current();
  });

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Ticks the hold timer while payment is still possible.
  useEffect(() => {
    if (holdDeadline === null || paid || error) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [holdDeadline, paid, error]);

  const holdRemainingMs = holdDeadline === null ? null : Math.max(0, holdDeadline - now);

  // Hold ran out: show the expired state instead of a Pay button the server
  // would reject. An in-flight payment is left to the server to decide.
  useEffect(() => {
    if (holdRemainingMs === 0 && !paid && !submitting) {
      setError({
        kind: "expired",
        message: "Your seat hold has expired. Please choose your seats again.",
      });
    }
  }, [holdRemainingMs, paid, submitting]);

  // Esc closes the success modal when it is open.
  useEffect(() => {
    if (!successOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSuccessOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [successOpen]);

  // Backend determines the amount — the button only echoes what the
  // summary returned. Single in-flight request: submitting guard blocks
  // double taps; the locked transaction + existing-paid check is the
  // real source of truth.
  const payNow = useCallback(async () => {
    if (reservationId === null || submitting) return;
    setSubmitting(true);
    try {
      const response = await apiPostAuth<PayResponse>(
        `/customer/reservations/${reservationId}/pay`,
        { payment_method: method }
      );
      setPaid(response);
      setSuccessOpen(true);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = getErrorMessage(err, "Please try again later.");
      if (status === 404) {
        setError({ kind: "notfound", message: "Reservation not found." });
      } else if (status === 409 && /expired/i.test(message)) {
        setError({
          kind: "expired",
          message: "Your seat hold has expired. Please choose your seats again.",
        });
      } else if (status === 409) {
        setError({ kind: "notpayable", message });
      } else {
        // Unknown failure: keep the summary for a retry, never fake success.
        showToastMessage("Payment failed", message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [reservationId, submitting, method, showToastMessage]);

  const goBackToMovies = () => navigate(ionRouter, "/movies");

  // Root navigation drops this page from history: Back after paying can
  // never land on a "not payable" Payment screen.
  const leaveAfterPayment = (path: string) => navigate(ionRouter, path, true);

  // Deep link back to the seat map when the schedule id is known; the
  // schedule came from the backend summary, never from client input.
  const chooseSeatsAgain = () => {
    const scheduleId = summary?.reservation.schedule_id;
    navigate(ionRouter, scheduleId ? `/booking/seats?schedule=${scheduleId}` : "/movies");
  };

  const renderErrorCard = () => {
    if (!error) return null;
    const isExpired = error.kind === "expired";
    const canRetry = error.kind === "failed";

    return (
      <div className="pay-error">
        <div className="pay-error__icon">
          <IonIcon icon={alertCircleOutline} />
        </div>
        <h2 className="pay-error__title">
          {isExpired ? "Reservation Expired" : "Unable to Pay"}
        </h2>
        <p className="pay-error__text">{error.message}</p>
        <div className="pay-error__actions">
          {isExpired && (
            <button type="button" className="pay-error__retry" onClick={chooseSeatsAgain}>
              Choose Seats Again
            </button>
          )}
          {canRetry && (
            <button type="button" className="pay-error__retry" onClick={() => void loadPayment()}>
              Retry
            </button>
          )}
          <button type="button" className="pay-error__back" onClick={goBackToMovies}>
            Back to Movies
          </button>
        </div>
      </div>
    );
  };

  const reservation = summary?.reservation ?? null;
  const place = reservation
    ? [reservation.branch?.name ?? "Cinema", reservation.screen?.name ?? null]
        .filter(Boolean)
        .join(" • ")
    : "";

  return (
    <IonPage>
      <div className="pay-page">
        <header className="pay-header">
          <button
            type="button"
            className="pay-header__back"
            aria-label="Back to movies"
            onClick={goBackToMovies}
          >
            <IonIcon icon={arrowBackOutline} />
          </button>
          <div className="pay-header__titles">
            <h1 className="pay-header__title">Payment</h1>
            {reservation && (
              <span className="pay-header__movie">{reservation.movie?.title ?? "Movie"}</span>
            )}
          </div>
        </header>

        <IonContent scrollY className="pay-content">
          <div className="pay-body">
            {loading ? (
              <div className="pay-loading">
                <IonSpinner name="crescent" />
              </div>
            ) : error ? (
              renderErrorCard()
            ) : reservation ? (
              <>
                {holdRemainingMs !== null && !paid && (
                  <div
                    className={`pay-hold${holdRemainingMs < 120000 ? " pay-hold--urgent" : ""}`}
                    role="timer"
                  >
                    <IonIcon icon={timeOutline} aria-hidden="true" />
                    <span>Seats held for</span>
                    <strong>{formatHoldRemaining(holdRemainingMs)}</strong>
                  </div>
                )}

                <section className="pay-section">
                  <span className="pay-section__label">Reservation</span>
                  <div className="pay-section__code">{reservation.reservation_code}</div>
                </section>

                <section className="pay-section">
                  <span className="pay-section__label">Movie</span>
                  <div className="pay-section__movie">
                    <IonIcon icon={filmOutline} className="pay-section__movie-icon" />
                    <strong>{reservation.movie?.title ?? "Untitled movie"}</strong>
                  </div>
                  <div className="pay-info">
                    <div className="pay-info__place">{place}</div>
                    {reservation.show_date && (
                      <div className="pay-info__date">{formatDate(reservation.show_date)}</div>
                    )}
                    {reservation.start_time && (
                      <div className="pay-info__time">{formatTime(reservation.start_time)}</div>
                    )}
                  </div>
                </section>

                <section className="pay-section">
                  <span className="pay-section__label">Seats</span>
                  {reservation.seats.length > 0 ? (
                    reservation.seats.map((seat, index) => (
                      <div className="pay-row" key={`${seat.label}-${index}`}>
                        <span>{seat.label}</span>
                        <strong>{formatPrice(seat.price)}</strong>
                      </div>
                    ))
                  ) : (
                    <div className="pay-row">
                      <span>Seats</span>
                      <strong>—</strong>
                    </div>
                  )}
                </section>

                <section className="pay-section">
                  <span className="pay-section__label">Payment Summary</span>
                  <div className="pay-row">
                    <span>Subtotal</span>
                    <strong>{formatPrice(reservation.subtotal)}</strong>
                  </div>
                  <div className="pay-row">
                    <span>Discount</span>
                    <strong>{formatPrice(reservation.discount_amount)}</strong>
                  </div>
                  <div className="pay-row pay-row--total">
                    <span>Total</span>
                    <strong>{formatPrice(reservation.total_amount)}</strong>
                  </div>
                </section>

                <section className="pay-section">
                  <div className="pay-section__heading">
                    <span className="pay-section__label" id="pay-method-label">
                      Payment Method
                    </span>
                    <span className="pay-method__badge">Demo</span>
                  </div>
                  <div className="pay-methods" role="radiogroup" aria-labelledby="pay-method-label">
                    {PAYMENT_METHODS.map((option) => {
                      const selected = option.value === method;
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          key={option.value}
                          className={`pay-method${selected ? " pay-method--selected" : ""}`}
                          disabled={submitting || paid !== null}
                          onClick={() => setMethod(option.value)}
                        >
                          <span className="pay-method__dot" aria-hidden="true" />
                          <IonIcon icon={option.icon} className="pay-method__icon" aria-hidden="true" />
                          <span className="pay-method__body">
                            <strong>{option.label}</strong>
                            <span>{option.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <div className="pay-footer">
                  {paid ? (
                    <>
                      <button
                        type="button"
                        className="pay-footer__button pay-footer__button--paid"
                        onClick={() => leaveAfterPayment("/tickets")}
                      >
                        <IonIcon icon={checkmarkCircleOutline} />
                        Paid — View My Ticket
                      </button>
                      <p className="pay-footer__note">
                        Ref {paid.payment.payment_reference} • Ticket {paid.ticket.ticket_code}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`pay-footer__button${submitting ? " pay-footer__button--busy" : ""}`}
                        disabled={submitting}
                        onClick={() => void payNow()}
                      >
                        {submitting ? (
                          <span className="pay-footer__spinner">
                            <IonSpinner name="crescent" />
                            Processing…
                          </span>
                        ) : (
                          `Pay ${formatPrice(reservation.total_amount)}`
                        )}
                      </button>
                      <p className="pay-footer__note">
                        Simulated payment — your card or wallet details are never collected.
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </IonContent>

        {paid && successOpen && (
          <div className="pay-modal">
            <div className="pay-modal__backdrop" />
            <div
              className="pay-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Payment successful"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pay-modal__header">
                <h2 className="pay-modal__title">Payment Successful</h2>
                <button
                  type="button"
                  className="pay-modal__close"
                  aria-label="Close"
                  onClick={() => setSuccessOpen(false)}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="pay-modal__scroll">
                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Payment</span>
                  <div className="pay-modal__row">
                    <span>Payment Reference</span>
                    <strong>{paid.payment.payment_reference}</strong>
                  </div>
                </div>

                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Reservation</span>
                  <div className="pay-modal__row">
                    <span>Reservation Code</span>
                    <strong>{paid.reservation.reservation_code}</strong>
                  </div>
                </div>

                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Ticket</span>
                  <div className="pay-modal__row">
                    <span>Ticket Code</span>
                    <strong>{paid.ticket.ticket_code}</strong>
                  </div>
                </div>

                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Amount Paid</span>
                  <div className="pay-modal__row">
                    <span>{formatMethod(paid.payment.payment_method)}</span>
                    <strong>{formatPrice(paid.payment.amount)}</strong>
                  </div>
                </div>

                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Reservation Status</span>
                  <div className="pay-modal__row">
                    <span>Status</span>
                    <strong className="pay-success__status">{formatStatus(paid.reservation.status)}</strong>
                  </div>
                </div>

                <div className="pay-modal__section">
                  <span className="pay-modal__section-label">Ticket Status</span>
                  <div className="pay-modal__row">
                    <span>Status</span>
                    <strong className="pay-success__status">{formatStatus(paid.ticket.status)}</strong>
                  </div>
                </div>
              </div>

              <div className="pay-modal__actions">
                <button
                  type="button"
                  className="pay-modal__confirm"
                  aria-label="View my ticket"
                  onClick={() => leaveAfterPayment("/tickets")}
                >
                  View My Ticket
                </button>
                <button
                  type="button"
                  className="pay-modal__secondary"
                  aria-label="Back to home"
                  onClick={() => leaveAfterPayment("/home")}
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`pay-toast ${showToast ? "pay-toast--visible" : ""}`}>
          <div className="pay-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="pay-toast__text">
            <span className="pay-toast__title">{toastTitle}</span>
            <span className="pay-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default Payment;
