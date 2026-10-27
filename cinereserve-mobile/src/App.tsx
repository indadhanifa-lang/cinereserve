import { Route } from 'react-router-dom';
import { createAnimation, IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import type { Animation } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Home from './pages/Home';
import History from './pages/History';
import Login from './pages/Login';
import Movies from './pages/Movies';
import Payment from './pages/Payment';
import PersonalInformation from './pages/PersonalInformation';
import Profile from './pages/Profile';
import Register from './pages/Register';
import SeatSelection from './pages/SeatSelection';
import Tickets from './pages/Tickets';
import Welcome from './pages/Welcome';
import ProtectedRoute from './lib/ProtectedRoute';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pageTransition = (baseEl: HTMLElement, opts?: { direction?: string; enteringEl?: HTMLElement; leavingEl?: HTMLElement }): Animation => {
  const DURATION = prefersReducedMotion ? 0 : 250;
  const SLIDE = prefersReducedMotion ? 0 : 12;
  const direction = opts?.direction || 'forward';
  const forward = direction === 'forward';

  const enteringEl = opts?.enteringEl;
  const leavingEl = opts?.leavingEl;

  const base = createAnimation('page-transition')
    .duration(DURATION)
    .easing('cubic-bezier(0.25, 0.1, 0.25, 1)');

  if (enteringEl) {
    base.addAnimation(
      createAnimation('entering-page')
        .addElement(enteringEl)
        .fromTo('opacity', '0', '1')
        .fromTo(
          'transform',
          `translateX(${forward ? SLIDE : -SLIDE}px)`,
          'translateX(0)'
        )
    );
  }

  if (leavingEl) {
    base.addAnimation(
      createAnimation('leaving-page')
        .addElement(leavingEl)
        .fromTo('opacity', '1', '0')
        .fromTo(
          'transform',
          'translateX(0)',
          `translateX(${forward ? -SLIDE : SLIDE}px)`
        )
    );
  }

  return base;
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet animation={pageTransition}>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/movies" element={<ProtectedRoute><Movies /></ProtectedRoute>} />
        <Route path="/booking/seats" element={<ProtectedRoute><SeatSelection /></ProtectedRoute>} />
        <Route path="/booking/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/personal-information" element={<ProtectedRoute><PersonalInformation /></ProtectedRoute>} />
        <Route path="/" element={<Welcome />} />
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);

export default App;
