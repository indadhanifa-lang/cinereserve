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
  filmOutline,
  homeOutline,
  idCardOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  personOutline,
  receiptOutline,
  ticketOutline,
} from 'ionicons/icons';
import { apiGetAuth, apiPostAuthLogout, clearToken, getToken, resolveStorageUrl } from '../lib/api';
import { navigate } from '../lib/nav';
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

  // Re-fetch every time the Profile page is entered (e.g. after saving
  // name/email in Personal Information and navigating back).
  useIonViewWillEnter(() => {
    loadProfile();
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
            <button type="button" className="icon-button" aria-label="Notifications">
              <IonIcon icon={notificationsOutline} />
            </button>
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

            <div className="profile-title-section">
              <h1 className="profile-title">Profile</h1>
            </div>

            <div className="profile-user-card">
              <div className="profile-user-card__gradient" aria-hidden="true" />
              <div className="profile-user-card__content">
                <div className="profile-user-card__left">
                  <div className="profile-user-card__avatar-wrap">
                    <div className="profile-user-card__avatar" style={{ position: 'relative' }}>
                      {loadingProfile && !user ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        <>
                          <span className="profile-user-card__initials">
                            {user ? getInitials(user.name) : '?'}
                          </span>
                          {avatarSrc && showAvatarImage && (
                            <img
                              key={avatarSrc}
                              src={avatarSrc}
                              alt=""
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '999px',
                              }}
                              onError={() => setFailedAvatarSrc(avatarSrc)}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <div className="profile-user-card__verified">
                      <IonIcon icon={personOutline} />
                    </div>
                  </div>
                  <div className="profile-user-card__info">
                    {loadingProfile && !user ? (
                      <IonSpinner name="dots" />
                    ) : (
                      <>
                        <span className="profile-user-card__name">{user?.name ?? ''}</span>
                        <span className="profile-user-card__email">{user?.email ?? ''}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="profile-user-card__badge">
                  <IonIcon icon={notificationsOutline} className="profile-user-card__badge-icon" />
                  <span className="profile-user-card__badge-text">Elite</span>
                </div>
              </div>
            </div>

            <div className="profile-section-header">
              <span className="profile-section-header__text">Account</span>
            </div>

            <div className="profile-menu">
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => navigate(ionRouter, '/profile/personal-information')}
              >
                <div className="profile-menu-item__left">
                  <div className="profile-menu-item__icon">
                    <IonIcon icon={idCardOutline} />
                  </div>
                  <span className="profile-menu-item__label">Personal Information</span>
                </div>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron" />
              </button>

              <button type="button" className="profile-menu-item">
                <div className="profile-menu-item__left">
                  <div className="profile-menu-item__icon">
                    <IonIcon icon={notificationsOutline} />
                  </div>
                  <span className="profile-menu-item__label">Notifications</span>
                </div>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron" />
              </button>

              <button
                type="button"
                className="profile-menu-item profile-menu-item--danger"
                onClick={() => setShowLogoutModal(true)}
              >
                <div className="profile-menu-item__left">
                  <div className="profile-menu-item__icon profile-menu-item__icon--danger">
                    <IonIcon icon={logOutOutline} />
                  </div>
                  <span className="profile-menu-item__label profile-menu-item__label--danger">Log Out</span>
                </div>
                <IonIcon icon={chevronForwardOutline} className="profile-menu-item__chevron profile-menu-item__chevron--danger" />
              </button>
            </div>

            <div className="profile-footer">
              <div className="profile-footer__info">
                <IonIcon icon={notificationsOutline} className="profile-footer__icon" />
                <span className="profile-footer__app">CineReserve AI App • v2.4.0</span>
              </div>
              <span className="profile-footer__powered">Powered by Neural Seating Engine</span>
            </div>
          </div>
        </IonContent>

        {showLogoutModal && (
          <div className="profile-logout-modal" onClick={() => !signingOut && setShowLogoutModal(false)}>
            <div className="profile-logout-modal__backdrop" />
            <div
              className="profile-logout-modal__sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profile-logout-modal__handle" />
              <div className="profile-logout-modal__content">
                <div className="profile-logout-modal__icon-wrap">
                  <IonIcon icon={logOutOutline} className="profile-logout-modal__icon" />
                </div>
                <div className="profile-logout-modal__text">
                  <span className="profile-logout-modal__title">Sign out of CineReserve AI?</span>
                  <span className="profile-logout-modal__desc">
                    Your pending reservations and VIP seating sync will be paused.
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
