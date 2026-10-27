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
import './Tickets.css';

type TicketSeat = { label: string };

type TicketItem = {
  id: number;
  ticket_code: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  is_active: boolean;
  created_at: string | null;
  checked_in_at: string | null;
  reservation: {
    id: number;
    reservation_code: string;
    status: string;
    total_amount: string | null;
  } | null;
  movie: { id: number; title: string; poster_url: string | null } | null;
  schedule: { show_date: string; start_time: string; end_time: string } | null;
  branch: { id: number | null; name: string | null };
  screen: { id: number | null; name: string | null };
  seats: TicketSeat[];
};

const STATUS_LABELS: Record<TicketItem['status'], string> = {
  valid: 'Valid',
  used: 'Used',
  cancelled: 'Cancelled',
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

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

const TicketIcon: React.FC = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeLinejoin="round"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path d="M8 14C8 11.7909 9.79086 10 12 10H36C38.2091 10 40 11.7909 40 14V20C38.3431 20 37 21.3431 37 23C37 24.6569 38.3431 26 40 26V34C40 36.2091 38.2091 38 36 38H12C9.79086 38 8 36.2091 8 34V26C9.65685 26 11 24.6569 11 23C11 21.3431 9.65685 20 8 20V14Z" />
    <path d="M19 18V30" strokeDasharray="2 3" strokeLinecap="round" />
    <rect fill="currentColor" height="3" rx="0.5" width="3" x="25" y="17" />
    <rect fill="currentColor" height="3" rx="0.5" width="3" x="31" y="17" />
    <rect fill="currentColor" height="3" rx="0.5" width="3" x="25" y="23" />
    <rect fill="currentColor" height="3" rx="0.5" width="3" x="31" y="23" />
    <rect fill="currentColor" height="3" rx="0.5" width="3" x="28" y="28" />
    <circle cx="24" cy="6" fill="#cebdff" opacity="0.6" r="1.5" />
    <circle cx="24" cy="42" fill="#cebdff" opacity="0.6" r="1.5" />
  </svg>
);

const Tickets: React.FC = () => {
  const ionRouter = useIonRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [failedPosterIds, setFailedPosterIds] = useState<number[]>([]);

  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastSubtitle, setToastSubtitle] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Header avatar (decorative): fetched independently of the ticket list;
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

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetAuth<{ tickets: TicketItem[] }>('/customer/tickets');
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
    } catch (error) {
      // Keep the page usable: keep any previously loaded tickets, surface a
      // toast, and never clear the token. Re-entering the tab retries.
      showToastMessage('Unable to load tickets', getErrorMessage(error, 'Please try again later.'));
    } finally {
      setLoading(false);
    }
  }, [showToastMessage]);

  useIonViewWillEnter(() => {
    void loadTickets();
    void loadHeaderAvatar();
  });

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  // Server classifies against Asia/Manila and returns active first (show
  // date ASC), then past (show date DESC) — filtering preserves both orders.
  const activeTickets = tickets.filter((ticket) => ticket.is_active);
  const pastTickets = tickets.filter((ticket) => !ticket.is_active);
  const visibleTickets = activeTab === 'active' ? activeTickets : pastTickets;

  const markPosterFailed = (id: number) =>
    setFailedPosterIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const renderPoster = (ticket: TicketItem, className: string) => {
    const posterSrc = resolveStorageUrl(ticket.movie?.poster_url);
    const failed = failedPosterIds.includes(ticket.id);
    return (
      <div className={className}>
        {posterSrc && !failed ? (
          <img src={posterSrc} alt={`${ticket.movie?.title ?? 'Movie'} poster`} onError={() => markPosterFailed(ticket.id)} />
        ) : (
          <div className="tickets-card__poster-placeholder" aria-hidden="true">
            <IonIcon icon={filmOutline} />
          </div>
        )}
      </div>
    );
  };

  const renderTicketCard = (ticket: TicketItem) => {
    const schedule = ticket.schedule;
    const place = [ticket.branch?.name ?? 'Cinema', ticket.screen?.name ?? null]
      .filter(Boolean)
      .join(' • ');

    return (
      <button
        type="button"
        key={ticket.id}
        className="tickets-card"
        onClick={() => setSelectedTicket(ticket)}
      >
        {renderPoster(ticket, 'tickets-card__poster')}
        <div className="tickets-card__body">
          <div className="tickets-card__top">
            <h3 className="tickets-card__title">{ticket.movie?.title ?? 'Untitled movie'}</h3>
            <span className={`tickets-card__status tickets-card__status--${ticket.status}`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
          <p className="tickets-card__code">{ticket.ticket_code}</p>
          <p className="tickets-card__place">{place}</p>
          {schedule && (
            <>
              <p className="tickets-card__date">{formatDate(schedule.show_date)}</p>
              <p className="tickets-card__time">
                {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
              </p>
            </>
          )}
          {ticket.seats.length > 0 && (
            <p className="tickets-card__seats">Seats: {ticket.seats.map((seat) => seat.label).join(', ')}</p>
          )}
          {ticket.reservation && (
            <p className="tickets-card__reservation">Reservation: {ticket.reservation.reservation_code}</p>
          )}
        </div>
      </button>
    );
  };

  const renderEmptyActive = () => (
    <div className="tickets-empty-card">
      <div className="tickets-empty-card__glow" aria-hidden="true" />
      <div className="tickets-empty-card__glow-bottom" aria-hidden="true" />
      <div className="tickets-empty-card__icon-wrap">
        <div className="tickets-empty-card__icon-glow" aria-hidden="true" />
        <div className="tickets-empty-card__icon">
          <TicketIcon />
        </div>
        <div className="tickets-beacon">
          <span className="tickets-beacon__ping" />
          <span className="tickets-beacon__dot" />
        </div>
      </div>
      <h2 className="tickets-empty-card__title">No Tickets Yet</h2>
      <p className="tickets-empty-card__text">
        Your confirmed movie tickets will appear here after you make a reservation.
      </p>
      <button
        type="button"
        className="tickets-browse-btn"
        onClick={() => navigate(ionRouter, '/movies')}
      >
        <IonIcon icon={filmOutline} className="tickets-browse-btn__icon" />
        <span>Browse Showtimes</span>
      </button>
    </div>
  );

  const renderEmptyPast = () => (
    <div className="tickets-past-card">
      <div className="tickets-past-icon">
        <IonIcon icon={receiptOutline} />
      </div>
      <h2 className="tickets-past-title">No Past Passes</h2>
      <p className="tickets-past-text">
        Your previous movie tickets will appear here after your screenings.
      </p>
    </div>
  );

  const selectedSchedule = selectedTicket?.schedule ?? null;

  return (
    <IonPage>
      <div className="tickets-page">
        <header className="tickets-header">
          <div className="tickets-header__brand">
            <img src="/logo.png" alt="CineReserve AI" className="tickets-header__logo" />
          </div>
          <div className="tickets-header__actions">
            <button type="button" className="icon-button" aria-label="Notifications">
              <IonIcon icon={notificationsOutline} />
            </button>
            <div className="tickets-header__avatar" aria-hidden="true">
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

        <IonContent scrollY className="tickets-content">
          <div className="tickets-body">
            <div className="tickets-title-section">
              <div className="tickets-title-row">
                <div>
                  <h1 className="tickets-title">My Tickets</h1>
                  <p className="tickets-subtitle">View your active and previous cinema tickets.</p>
                </div>
                <div className="tickets-title-icon">
                  <IonIcon icon={ticketOutline} />
                </div>
              </div>

              <div className="tickets-segment">
                <button
                  type="button"
                  className={`tickets-seg-btn${activeTab === 'active' ? ' tickets-seg-btn--active' : ''}`}
                  onClick={() => setActiveTab('active')}
                >
                  <span>Active</span>
                  {!loading && <span className="tickets-seg-badge">{activeTickets.length}</span>}
                </button>
                <button
                  type="button"
                  className={`tickets-seg-btn${activeTab === 'past' ? ' tickets-seg-btn--active' : ''}`}
                  onClick={() => setActiveTab('past')}
                >
                  <span>Past Passes</span>
                  {!loading && <span className="tickets-seg-badge">{pastTickets.length}</span>}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="tickets-loading">
                <IonSpinner name="crescent" />
              </div>
            ) : visibleTickets.length > 0 ? (
              <div className="tickets-list">{visibleTickets.map(renderTicketCard)}</div>
            ) : activeTab === 'active' ? (
              renderEmptyActive()
            ) : (
              renderEmptyPast()
            )}

            <div className="tickets-info">
              <div className="tickets-info__icon">
                <IonIcon icon={ticketOutline} />
              </div>
              <div className="tickets-info__body">
                <div className="tickets-info__label">
                  <span>Good to know</span>
                  <span className="tickets-info__dot" />
                </div>
                <p className="tickets-info__text">
                  Your movie tickets, seats, and showtime details are available here after booking.
                </p>
              </div>
            </div>

            <div className="tickets-features">
              <div className="tickets-feature">
                <div className="tickets-feature__icon">
                  <IonIcon icon={notificationsOutline} />
                </div>
                <span className="tickets-feature__label">Showtime Reminders</span>
              </div>
            </div>
          </div>
        </IonContent>

        {selectedTicket && (
          <div className="tickets-modal" onClick={() => setSelectedTicket(null)}>
            <div className="tickets-modal__backdrop" />
            <div
              className="tickets-modal__sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Ticket details"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tickets-modal__header">
                <h2 className="tickets-modal__title">Ticket Details</h2>
                <button
                  type="button"
                  className="tickets-modal__close"
                  aria-label="Close"
                  onClick={() => setSelectedTicket(null)}
                >
                  <IonIcon icon={closeOutline} />
                </button>
              </div>

              <div className="tickets-modal__scroll">
                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Ticket</span>
                  <div className="tickets-modal__row">
                    <span>Ticket Code</span>
                    <strong>{selectedTicket.ticket_code}</strong>
                  </div>
                  <div className="tickets-modal__row">
                    <span>Status</span>
                    <strong className={`tickets-card__status tickets-card__status--${selectedTicket.status}`}>
                      {STATUS_LABELS[selectedTicket.status] ?? selectedTicket.status}
                    </strong>
                  </div>
                </div>

                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Movie</span>
                  <div className="tickets-modal__movie">
                    {renderPoster(selectedTicket, 'tickets-modal__poster')}
                    <strong>{selectedTicket.movie?.title ?? 'Untitled movie'}</strong>
                  </div>
                </div>

                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Cinema</span>
                  <div className="tickets-modal__row">
                    <span>Branch</span>
                    <strong>{selectedTicket.branch?.name ?? '—'}</strong>
                  </div>
                  <div className="tickets-modal__row">
                    <span>Screen</span>
                    <strong>{selectedTicket.screen?.name ?? '—'}</strong>
                  </div>
                </div>

                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Showtime</span>
                  <div className="tickets-modal__row">
                    <span>Show Date</span>
                    <strong>{selectedSchedule ? formatDate(selectedSchedule.show_date) : '—'}</strong>
                  </div>
                  <div className="tickets-modal__row">
                    <span>Start Time</span>
                    <strong>{selectedSchedule ? formatTime(selectedSchedule.start_time) : '—'}</strong>
                  </div>
                  <div className="tickets-modal__row">
                    <span>End Time</span>
                    <strong>{selectedSchedule ? formatTime(selectedSchedule.end_time) : '—'}</strong>
                  </div>
                </div>

                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Seats</span>
                  {selectedTicket.seats.length > 0 ? (
                    <div className="tickets-modal__seats">
                      {selectedTicket.seats.map((seat, index) => (
                        <span className="tickets-modal__seat" key={`${seat.label}-${index}`}>
                          {seat.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="tickets-modal__row">
                      <span>Seats</span>
                      <strong>—</strong>
                    </div>
                  )}
                </div>

                <div className="tickets-modal__section">
                  <span className="tickets-modal__section-label">Reservation</span>
                  <div className="tickets-modal__row">
                    <span>Reservation Code</span>
                    <strong>{selectedTicket.reservation?.reservation_code ?? '—'}</strong>
                  </div>
                  <div className="tickets-modal__row">
                    <span>Total Amount</span>
                    <strong>
                      {selectedTicket.reservation?.total_amount
                        ? formatPrice(selectedTicket.reservation.total_amount)
                        : '—'}
                    </strong>
                  </div>
                </div>
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
          <a className="bottom-nav__item bottom-nav__item--active" href="#" aria-current="page">
            <IonIcon icon={ticketOutline} />
            <span>Tickets</span>
          </a>
          <a
            className="bottom-nav__item"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate(ionRouter, '/history');
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
              navigate(ionRouter, '/profile');
            }}
          >
            <IonIcon icon={personCircleOutline} />
            <span>Profile</span>
          </a>
        </nav>

        <div className={`tickets-toast ${showToast ? 'tickets-toast--visible' : ''}`}>
          <div className="tickets-toast__icon">
            <IonIcon icon={alertCircleOutline} />
          </div>
          <div className="tickets-toast__text">
            <span className="tickets-toast__title">{toastTitle}</span>
            <span className="tickets-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default Tickets;
