import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import {
  arrowForwardOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { navigate } from '../lib/nav';
import './Welcome.css';

const ChairIcon: React.FC = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M4 18v3h3v-3a3 3 0 0 0-3-3zm0-4a7 7 0 0 0 6 6.93V19H6v2H2v-4a4 4 0 0 1 4-4h1.07A7 7 0 0 0 4 14zm16-4a7 7 0 0 0-6-6.93V5h4v-2h4v4a4 4 0 0 1-4 4h-1.07A7 7 0 0 0 20 10zm-8-7a2 2 0 0 0-2 2v2h4V5a2 2 0 0 0-2-2z" />
  </svg>
);

const Welcome: React.FC = () => {
  const router = useIonRouter();

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="welcome-content">
        <div className="welcome-page">
          <div className="welcome-glow welcome-glow--top" aria-hidden="true" />
          <div className="welcome-glow welcome-glow--right" aria-hidden="true" />
          <div className="welcome-glow welcome-glow--left" aria-hidden="true" />

          <div className="welcome-stream">
            <header className="welcome-header">
              <div className="welcome-logo-pill">
                <img
                  src="/logo.png"
                  alt="CineReserve AI"
                  className="welcome-logo-img"
                />
              </div>

              <div className="welcome-brand">
                <span className="welcome-brand__name">CineReserve</span>
                <span className="welcome-brand__ai">AI</span>
              </div>

              <p className="welcome-tagline">Your seat. Your movie. Your moment.</p>
            </header>

            <section className="welcome-hero-section">
              <div className="welcome-hero-glow" aria-hidden="true" />

              <div className="welcome-hero-card">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAfpL5Fh0jEcSx86d2HF9ok4-cgADC_2KPessSpvhRpYIbGzOio1E1e9GrucUM1d1n-0o2tfljJc-M1HRoj1eZHO5ocEdEWVBQUUdXu241qiyFIBN-tk6u6DiXXXb4F2UMymv43HOi5qTAEv38LXEh4qpkWC1Ah6aHg8BUKRn-aH-4JLD2Z6m1UBSpSMHhxEoqXZctD7FqNlg5k8HfRhmkOlsOslZfdwatt7scGCruovdZvvA0b3dpc8g"
                  alt="Cinema auditorium"
                  className="welcome-hero-img"
                />
                <div className="welcome-hero-vignette" aria-hidden="true" />
                <div className="welcome-hero-bar" aria-hidden="true" />

                <div className="welcome-hero-badge">
                  <span className="welcome-hero-badge__dot" />
                  <span>Dolby Atmos &bull; Laser</span>
                </div>

                <div className="welcome-hero-scrim" aria-hidden="true" />
              </div>

              <div className="welcome-seat-indicator">
                <ChairIcon />
                <span>Smart Hall 04 &bull; Prime Rows Synchronized</span>
              </div>
            </section>

            <footer className="welcome-footer">
              <div className="welcome-narrative">
                <h1 className="welcome-narrative__heading">
                  Movies are better when your seat is ready.
                </h1>
                <p className="welcome-narrative__body">
                  Discover movies, choose your preferred cinema and reserve your seat
                  in just a few taps.
                </p>
              </div>

              <div className="welcome-actions">
                <IonButton
                  expand="block"
                  onClick={() => navigate(router, '/register')}
                  className="welcome-btn welcome-btn--primary"
                >
                  <span className="welcome-btn__label">Get Started</span>
                  <IonIcon icon={arrowForwardOutline} className="welcome-btn__icon" />
                </IonButton>

                <div className="welcome-signin-row">
                  <span className="welcome-signin-row__text">Already have an account?</span>
                  <IonButton
                    fill="clear"
                    onClick={() => navigate(router, '/login')}
                    className="welcome-signin-btn"
                  >
                    <span>Sign In</span>
                    <IonIcon icon={chevronForwardOutline} className="welcome-signin-btn__icon" />
                  </IonButton>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Welcome;
