import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  alertCircleOutline,
  chevronForwardOutline,
  createOutline,
  filmOutline,
  homeOutline,
  idCardOutline,
  logOutOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  ticketOutline,
} from 'ionicons/icons';
import { resetHelpChat } from '../components/HelpChat';
import { apiGetAuth, apiPostAuthLogout, clearToken, getToken, resolveStorageUrl } from '../lib/api';
import { navigate } from '../lib/nav';
import NotificationBell from '../components/NotificationBell';
import './Profile.css';

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

type TicketCounts = { upcoming: number; past: number };

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
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

const Profile: React.FC = () => {
  const ionRouter = useIonRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [user, setUser] = useState<CustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  // Remember URLs whose image failed to load so we keep the initials
  // fallback instead of retrying (and flashing) on every render.
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastSubtitle, setToastSubtitle] = useState('');
  // Ticket counts are a nice-to-have: a failed fetch just hides the stats.
  const [ticketCounts, setTicketCounts] = useState<TicketCounts | null>(null);
  const loadingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2800);
  }, []);

  const loadProfile = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingProfile(true);
    try {
      const data = await apiGetAuth<ProfileResponse>('/customer/me');
      setUser(data.user);
    } catch (error) {
      showToastMessage('Unable to load profile', getErrorMessage(error, 'Please try again later.'));
    } finally {
      loadingRef.current = false;
      setLoadingProfile(false);
    }
  }, [showToastMessage]);

  const loadTicketCounts = useCallback(async () => {
    try {
      const data = await apiGetAuth<{ tickets: { is_active: boolean }[] }>('/customer/tickets');
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      const upcoming = tickets.filter((ticket) => ticket.is_active).length;
      setTicketCounts({ upcoming, past: tickets.length - upcoming });
    } catch {
      setTicketCounts(null);
    }
  }, []);

  // Re-fetch every time the Profile page is entered (e.g. after saving
  // name/email in Personal Information and navigating back).
  useIonViewWillEnter(() => {
    loadProfile();
    void loadTicketCounts();
  });

  // Safety net for the very first render in case the view lifecycle
  // event has already fired before this component mounts.
  useEffect(() => {
    loadProfile();
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loadProfile]);

  // Absolute URL for the stored relative path ("/storage/avatars/x.webp").
  // Built from the existing API origin config in lib/api.ts — never hardcoded.
  const avatarSrc = resolveStorageUrl(user?.avatar_url);
  const showAvatarImage = Boolean(avatarSrc) && avatarSrc !== failedAvatarSrc;

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const token = getToken();
      if (token) {
        await apiPostAuthLogout();
      }
    } finally {
      clearToken();
      resetHelpChat();
      setShowLogoutModal(false);
      setSigningOut(false);
      ionRouter.push('/login', 'root');
    }
  };

  return (
    <IonPage>
      <div className="profile-page">
        <header className="profile-header">
          <div className="profile-header__brand">
            <img src="/logo.png" alt="CineReserve AI" className="profile-header__logo" />
          </div>
          <div className="profile-header__actions">
            <NotificationBell />
            <div className="profile-header__avatar" aria-hidden="true">
              {avatarSrc && showAvatarImage ? (
                <img src={avatarSrc} alt="" onError={() => setFailedAvatarSrc(avatarSrc)} />
              ) : (
                <IonIcon icon={personOutline} />
              )}
            </div>
          </div>
        </header>

        <IonContent scrollY className="profile-content">
          <div className="profile-body">
            <div className="profile-glow" aria-hidden="true" />

            <h1 className="profile-title">Profile</h1>

            <section className="profile-hero" aria-busy={loadingProfile && !user}>
              <div className="profile-hero__top">
                <div className="profile-hero__avatar">
                  {loadingProfile && !user ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    <>
                      <span className="profile-hero__initials">{user ? getInitials(user.name) : '?'}</span>
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
                  )}
                </div>
                <div className="profile-hero__info">
                  {loadingProfile && !user ? (
                    <>
                      <span className="profile-skeleton profile-skeleton--name" />
                      <span className="profile-skeleton profile-skeleton--email" />
                    </>
                  ) : (
                    <>
                      <span className="profile-hero__name">{user?.name ?? ''}</span>
                      <span className="profile-hero__meta">{user?.email ?? ''}</span>
                      {user?.phone && <span className="profile-hero__meta">{user.phone}</span>}
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="profile-hero__edit"
                onClick={() => navigate(ionRouter, '/profile/personal-information')}
              >
                <IonIcon icon={createOutline} />
                <span>Edit profile</span>
              </button>

              {ticketCounts && (
                <div className="profile-stats">
                  <button
                    type="button"
                    className="profile-stat"
                    onClick={() => navigate(ionRouter, '/tickets')}
                  >
                    <strong>{ticketCounts.upcoming}</strong>
                    <span>Upcoming {ticketCounts.upcoming === 1 ? 'ticket' : 'tickets'}</span>
                  </button>
                  <button
                    type="button"
                    className="profile-stat"
                    onClick={() => navigate(ionRouter, '/history')}
                  >
                    <strong>{ticketCounts.past}</strong>
                    <span>Past {ticketCounts.past === 1 ? 'show' : 'shows'}</span>
                  </button>
                </div>
              )}
            </section>

            <h2 className="profile-section-header">Your activity</h2>
            <div className="profile-menu">
              <button type="button" className="profile-menu-item" onClick={() => navigate(ionRouter, '/tickets')}>
                <span className="profile-menu-item__icon">
                  <IonIcon icon={ticketOutline} />
                </span>
                <span className="profile-menu-item__text">
                  <span className="profile-menu-item__label">My tickets</span>
                  <span className="profile-menu-item__hint">Passes for your upcoming shows</span>
                </span>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron" />
              </button>
              <button type="button" className="profile-menu-item" onClick={() => navigate(ionRouter, '/history')}>
                <span className="profile-menu-item__icon">
                  <IonIcon icon={receiptOutline} />
                </span>
                <span className="profile-menu-item__text">
                  <span className="profile-menu-item__label">Booking history</span>
                  <span className="profile-menu-item__hint">Reservations and payments</span>
                </span>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron" />
              </button>
            </div>

            <h2 className="profile-section-header">Account</h2>
            <div className="profile-menu">
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => navigate(ionRouter, '/profile/personal-information')}
              >
                <span className="profile-menu-item__icon">
                  <IonIcon icon={idCardOutline} />
                </span>
                <span className="profile-menu-item__text">
                  <span className="profile-menu-item__label">Personal information</span>
                  <span className="profile-menu-item__hint">Name, email, phone and photo</span>
                </span>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron" />
              </button>
            </div>

            <button
              type="button"
              className="profile-logout-btn"
              onClick={() => setShowLogoutModal(true)}
            >
              <IonIcon icon={logOutOutline} />
              <span>Log out</span>
            </button>

            <p className="profile-footer">CineReserve AI · v2.4.0</p>
          </div>
        </IonContent>

        {showLogoutModal && (
          <div className="profile-logout-modal" onClick={() => !signingOut && setShowLogoutModal(false)}>
            <div className="profile-logout-modal__backdrop" />
            <div
              className="profile-logout-modal__sheet"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="profile-logout-title"
              aria-describedby="profile-logout-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-logout-modal__content">
                <div className="profile-logout-modal__icon-wrap">
                  <IonIcon icon={logOutOutline} className="profile-logout-modal__icon" />
                </div>
                <div className="profile-logout-modal__text">
                  <span id="profile-logout-title" className="profile-logout-modal__title">Sign out of CineReserve AI?</span>
                  <span id="profile-logout-desc" className="profile-logout-modal__desc">
                    You'll need to sign in again to book seats or open your tickets.
                  </span>
                </div>
              </div>
              <div className="profile-logout-modal__actions">
                <IonButton
                  expand="block"
                  className="profile-logout-modal__cancel"
                  onClick={() => !signingOut && setShowLogoutModal(false)}
                >
                  Cancel
                </IonButton>
                <IonButton
                  expand="block"
                  className="profile-logout-modal__confirm"
                  onClick={handleLogout}
                  disabled={signingOut}
                >
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </IonButton>
              </div>
            </div>
          </div>
        )}

        <div className={`pi-toast ${showToast ? 'pi-toast--visible' : ''}`}>
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
          <a className="bottom-nav__item bottom-nav__item--active" href="#" aria-current="page">
            <IonIcon icon={personCircleOutline} />
            <span>Profile</span>
          </a>
        </nav>
      </div>
    </IonPage>
  );
};

export default Profile;
