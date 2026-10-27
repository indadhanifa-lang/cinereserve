import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  alertCircleOutline,
  calendarOutline,
  closeOutline,
  filmOutline,
  homeOutline,
  notificationsOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  ticketOutline,
} from 'ionicons/icons';
import { apiGetAuth, resolveStorageUrl } from '../lib/api';
import { navigate } from '../lib/nav';
import './History.css';

type HistorySeat = { label: string };

type HistoryPayment = { method: string; status: string; amount: string };

type HistoryItem = {
  id: number;
  reservation_code: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  reserved_at: string | null;
  movie: { id: number; title: string; poster_url: string | null } | null;
  branch: { id: number | null; name: string | null };
  screen: { id: number | null; name: string | null };
  schedule: { show_date: string | null; start_time: string | null; end_time: string | null };
  seats: HistorySeat[];
  payment: HistoryPayment | null;
};

// Real reservation statuses only — "History" is a UI classification
// decided by the backend, never a reservation status.
const STATUS_LABELS: Record<HistoryItem['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  expired: 'Expired',
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const apiError = error as { message?: string; errors?: Record<string, string[]> };
    const firstError = apiError.errors ? Object.values(apiError.errors)[0] : undefined;
    if (firstError && firstError[0]) return firstError[0];
    if (apiError.message) return apiError.message;
  }
  return fallback;
};

/** HH:MM:SS (or HH:MM) → "8:00 AM" */
const formatTime = (time: string): string => {
  const [rawHours, minutes] = time.split(':').map(Number);
  const hours = rawHours ?? 0;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${period}`;
};

/** show_date (YYYY-MM-DD) → "Oct 5, 2026". Date object used only for
 * display formatting, never for date-only comparison. */
const formatDate = (showDate: string): string => {
  const [year, month, day] = showDate.split('-').map(Number);
  if (!year || !month || !day) return showDate;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/** "250.00" or 250 → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

const History: React.FC = () => {
  const ionRouter = useIonRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [failedPosterIds, setFailedPosterIds] = useState<number[]>([]);

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastSubtitle, setToastSubtitle] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Header avatar (decorative): fetched independently of the history list;
  // any failure simply keeps the default person icon.
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [failedHeaderAvatarUrl, setFailedHeaderAvatarUrl] = useState<string | null>(null);

  const loadHeaderAvatar = useCallback(async () => {
    try {
      const data = await apiGetAuth<{ user: { avatar_url: string | null } }>('/customer/me');
      setHeaderAvatarUrl(resolveStorageUrl(data.user?.avatar_url));
      setFailedHeaderAvatarUrl(null);
    } catch {
      setHeaderAvatarUrl(null);
    }
  }, []);
  // Monotonic id: only the newest request may write state, so a slow
  // response can never repaint stale history over a newer one.
  const requestRef = useRef(0);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  const loadHistory = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const data = await apiGetAuth<{ history: HistoryItem[] }>('/customer/history');
      if (requestId !== requestRef.current) return;
      setItems(Array.isArray(data.history) ? data.history : []);
      setLoadFailed(false);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      // Keep the page usable: keep previously loaded items, surface a
      // toast, and never clear the token. Re-entering the tab retries.
      setLoadFailed(true);
      showToastMessage('Unable to load history', getErrorMessage(error, 'Please try again later.'));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [showToastMessage]);

  useIonViewWillEnter(() => {
    void loadHistory();
    void loadHeaderAvatar();
  });

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Esc closes the details modal when it is open.
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const markPosterFailed = (id: number) =>
    setFailedPosterIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const renderPoster = (item: HistoryItem, className: string) => {
    const posterSrc = resolveStorageUrl(item.movie?.poster_url);
    const failed = failedPosterIds.includes(item.id);
    return (
      <div className={className}>
        {posterSrc && !failed ? (
          <img
            src={posterSrc}
            alt={`${item.movie?.title ?? 'Movie'} poster`}
            onError={() => markPosterFailed(item.id)}
          />
        ) : (
          <div className="history-card__poster-placeholder" aria-hidden="true">
            <IonIcon icon={filmOutline} />
          </div>
        )}
      </div>
    );
  };

  const renderHistoryCard = (item: HistoryItem) => {
    const place = [item.branch?.name ?? 'Cinema', item.screen?.name ?? null]
      .filter(Boolean)
      .join(' • ');
    const schedule = item.schedule;
    const hasShowtime = Boolean(schedule?.show_date);

    return (
      <button
        type="button"
        key={item.id}
        className="history-card"
        onClick={() => setSelected(item)}
      >
        {renderPoster(item, 'history-card__poster')}
        <div className="history-card__body">
          <div className="history-card__top">
            <h3 className="history-card__title">{item.movie?.title ?? 'Untitled movie'}</h3>
            <span className={`history-badge history-badge--${item.status}`}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          <p className="history-card__code">{item.reservation_code}</p>
          <p className="history-card__place">{place}</p>
          {hasShowtime && schedule?.show_date && (
            <>
              <p className="history-card__date">{formatDate(schedule.show_date)}</p>
              {schedule.start_time && schedule.end_time && (
                <p className="history-card__time">
                  {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                </p>
              )}
            </>
          )}
          {item.seats.length > 0 && (
            <p className="history-card__seats">Seats: {item.seats.map((seat) => seat.label).join(', ')}</p>
          )}
          <p className="history-card__total">{formatPrice(item.total_amount)}</p>
        </div>
      </button>
    );
  };

  const renderErrorCard = () => (
    <div className="history-empty-card">
      <div className="history-empty-card__glow" aria-hidden="true" />
      <div className="history-empty-card__gradient" aria-hidden="true" />
      <div className="history-empty-card__icon-wrap">
        <div className="history-empty-card__icon-glow" aria-hidden="true" />
        <div className="history-empty-card__icon">
          <IonIcon icon={calendarOutline} />
        </div>
      </div>
      <h2 className="history-empty-card__title">Unable to Load History</h2>
      <p className="history-empty-card__text">
        Please check your connection and try again.
      </p>
      <button
        type="button"
        className="history-explore-btn"
        onClick={() => void loadHistory()}
      >
        <IonIcon icon={ticketOutline} className="history-explore-btn__icon" />
        <span>Try Again</span>
      </button>
    </div>
  );

  const renderEmptyCard = () => (
    <div className="history-empty-card">
      <div className="history-empty-card__glow" aria-hidden="true" />
      <div className="history-empty-card__gradient" aria-hidden="true" />
      <div className="history-empty-card__icon-wrap">
        <div className="history-empty-card__icon-glow" aria-hidden="true" />
        <div className="history-empty-card__icon">
          <IonIcon icon={calendarOutline} />
        </div>
      </div>
      <h2 className="history-empty-card__title">No Booking History</h2>
      <p className="history-empty-card__text">
        Your previous cinema reservations will appear here.
      </p>
      <button
        type="button"
        className="history-explore-btn"
        onClick={() => navigate(ionRouter, '/movies')}
      >
        <IonIcon icon={ticketOutline} className="history-explore-btn__icon" />
        <span>Explore Now Showing</span>
      </button>
    </div>
  );

  const schedule = selected?.schedule ?? null;

  return (
    <IonPage>
      <div className="history-page">
        <header className="history-header">
          <div className="history-header__brand">
            <img src="/logo.png" alt="CineReserve AI" className="history-header__logo" />
          </div>
          <div className="history-header__actions">
            <button type="button" className="icon-button" aria-label="Notifications">
              <IonIcon icon={notificationsOutline} />
            </button>
            <div className="history-header__avatar" aria-hidden="true">
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

        <IonContent scrollY className="history-content">
          <div className="history-body">
            <div className="history-title-section">
              <h1 className="history-title">Booking History</h1>
              <p className="history-subtitle">View your previous cinema reservations.</p>
            </div>

            {loading ? (
              <div className="history-loading">
                <IonSpinner name="crescent" />
              </div>
            ) : items.length === 0 ? (
              loadFailed ? (
                renderErrorCard()
              ) : (
                renderEmptyCard()
              )
            ) : (
              <>
                <div className="history-list">
                  {items.map((item) => renderHistoryCard(item))}
                </div>
                {loadFailed && (
                  <p className="history-list__note">
                    Some history could not be refreshed. Reopen this tab to retry.
                  </p>
                )}
              </>
            )}
          </div>
        </IonContent>

        {selected && (
          <div className="history-modal" onClick={() => setSelected(null)}>
            <div className="history-modal__backdrop" />
            <div
              className="history-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Booking details"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="history-modal__header">
                <h2 className="history-modal__title">Booking Details</h2>
                <button
                  type="button"
                  className="history-modal__close"
                  aria-label="Close"
                  onClick={() => setSelected(null)}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="history-modal__scroll">
                <div className="history-modal__section">
                  <span className="history-modal__section-label">Booking</span>
                  <div className="history-modal__row">
                    <span>Reservation Code</span>
                    <strong>{selected.reservation_code}</strong>
                  </div>
                  <div className="history-modal__row">
                    <span>Reservation Status</span>
                    <strong>
                      <span className={`history-badge history-badge--${selected.status}`}>
                        {STATUS_LABELS[selected.status] ?? selected.status}
                      </span>
                    </strong>
                  </div>
                  <div className="history-modal__row">
                    <span>Reserved At</span>
                    <strong>{selected.reserved_at ?? '—'}</strong>
                  </div>
                </div>

                <div className="history-modal__section">
                  <span className="history-modal__section-label">Movie</span>
                  <div className="history-modal__movie">
                    {renderPoster(selected, 'history-modal__poster')}
                    <strong>{selected.movie?.title ?? 'Untitled movie'}</strong>
                  </div>
                </div>

                <div className="history-modal__section">
                  <span className="history-modal__section-label">Cinema</span>
                  <div className="history-modal__row">
                    <span>Branch</span>
                    <strong>{selected.branch?.name ?? '—'}</strong>
                  </div>
                  <div className="history-modal__row">
                    <span>Screen</span>
                    <strong>{selected.screen?.name ?? '—'}</strong>
                  </div>
                </div>

                <div className="history-modal__section">
                  <span className="history-modal__section-label">Showtime</span>
                  <div className="history-modal__row">
                    <span>Show Date</span>
                    <strong>{schedule?.show_date ? formatDate(schedule.show_date) : '—'}</strong>
                  </div>
                  <div className="history-modal__row">
                    <span>Start Time</span>
                    <strong>{schedule?.start_time ? formatTime(schedule.start_time) : '—'}</strong>
                  </div>
                  <div className="history-modal__row">
                    <span>End Time</span>
                    <strong>{schedule?.end_time ? formatTime(schedule.end_time) : '—'}</strong>
                  </div>
                </div>

                <div className="history-modal__section">
                  <span className="history-modal__section-label">Seats</span>
                  {selected.seats.length > 0 ? (
                    <div className="history-modal__seats">
                      {selected.seats.map((seat, index) => (
                        <span className="history-modal__seat" key={`${seat.label}-${index}`}>
                          {seat.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="history-modal__row">
                      <span>Seats</span>
                      <strong>—</strong>
                    </div>
                  )}
                </div>

                <div className="history-modal__section">
                  <span className="history-modal__section-label">Payment Summary</span>
                  <div className="history-modal__row">
                    <span>Subtotal</span>
                    <strong>{formatPrice(selected.subtotal)}</strong>
                  </div>
                  <div className="history-modal__row">
                    <span>Discount</span>
                    <strong>{formatPrice(selected.discount_amount)}</strong>
                  </div>
                  <div className="history-modal__row history-modal__row--total">
                    <span>Total</span>
                    <strong>{formatPrice(selected.total_amount)}</strong>
                  </div>
                </div>

                {selected.payment && (
                  <div className="history-modal__section">
                    <span className="history-modal__section-label">Payment</span>
                    <div className="history-modal__row">
                      <span>Method</span>
                      <strong className="history-modal__capitalize">{selected.payment.method}</strong>
                    </div>
                    <div className="history-modal__row">
                      <span>Payment Status</span>
                      <strong className="history-modal__capitalize">{selected.payment.status}</strong>
                    </div>
                    <div className="history-modal__row">
                      <span>Amount</span>
                      <strong>{formatPrice(selected.payment.amount)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <nav className="bottom-nav">
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, '/home');
            }}
          >
            <IonIcon icon={homeOutline} />
            <span>Home</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, '/movies');
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
              navigate(ionRouter, '/tickets');
            }}
          >
            <IonIcon icon={ticketOutline} />
            <span>Tickets</span>
          </a>
          <a className="bottom-nav__item bottom-nav__item--active" href="#" aria-current="page">
            <IonIcon icon={receiptOutline} />
            <span>History</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, '/profile');
            }}
          >
            <IonIcon icon={personCircleOutline} />
            <span>Profile</span>
          </a>
        </nav>

        <div className={`history-toast ${showToast ? 'history-toast--visible' : ''}`}>
          <div className="history-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="history-toast__text">
            <span className="history-toast__title">{toastTitle}</span>
            <span className="history-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default History;
