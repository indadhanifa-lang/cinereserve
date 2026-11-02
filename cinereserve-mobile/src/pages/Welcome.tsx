import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import { arrowForwardOutline, chevronForwardOutline } from 'ionicons/icons';
import { navigate } from '../lib/nav';
import './Welcome.css';

const STEPS = ['Pick a movie', 'Choose a cinema', 'Book a seat or room'];

const Welcome: React.FC = () => {
  const router = useIonRouter();

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="welcome-content">
        <div className="welcome-page">
          <div className="welcome-backdrop" aria-hidden="true">
            <img src="/screen.png" alt="" className="welcome-backdrop__img" />
          </div>

          <div className="welcome-stream">
            <header className="welcome-header">
              <img src="/logo.png" alt="CineReserve AI" className="welcome-logo-img" />
            </header>

            <section className="welcome-copy">
              <p className="welcome-eyebrow">Your seat. Your movie. Your moment.</p>
              <h1 className="welcome-heading">
                Movies are better when your seat is <em>ready.</em>
              </h1>
              <p className="welcome-body">
                Discover movies, choose your preferred cinema and book a seat or a whole room in
                just a few taps.
              </p>

              <ol className="welcome-steps">
                {STEPS.map((step, index) => (
                  <li key={step} className="welcome-step">
                    <span className="welcome-step__num">{index + 1}</span>
                    <span className="welcome-step__label">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="welcome-actions">
              <IonButton
                expand="block"
                onClick={() => navigate(router, '/register')}
                className="welcome-btn welcome-btn--primary"
              >
                <span className="welcome-btn__label">Get started</span>
                <IonIcon icon={arrowForwardOutline} className="welcome-btn__icon" />
              </IonButton>

              <div className="welcome-signin-row">
                <span className="welcome-signin-row__text">Already have an account?</span>
                <IonButton
                  fill="clear"
                  onClick={() => navigate(router, '/login')}
                  className="welcome-signin-btn"
                >
                  <span>Sign in</span>
                  <IonIcon icon={chevronForwardOutline} className="welcome-signin-btn__icon" />
                </IonButton>
              </div>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Welcome;
