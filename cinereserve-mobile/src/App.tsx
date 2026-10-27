import { useEffect, useRef } from 'react';
import { Route } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createAnimation, IonApp, IonRouterOutlet, setupIonicReact, useIonRouter } from '@ionic/react';
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

const TRANSITION_MS = 260;

// Index of the page's active bottom-nav tab, or -1 for pages without the nav.
const tabIndex = (page?: HTMLElement) => {
  const active = page?.querySelector('.bottom-nav__item--active');
  return active?.parentElement ? Array.from(active.parentElement.children).indexOf(active) : -1;
};

// Tab pages keep their bottom nav anchored: only the header and content slide,
// while the nav crossfades so the active tab color blends between pages.
const pageParts = (page: HTMLElement) => {
  const shell = page.querySelector('.bottom-nav')?.parentElement;
  return shell
    ? { fade: shell, slide: Array.from(shell.querySelectorAll<HTMLElement>(':scope > header, :scope > ion-content')) }
    : { fade: page, slide: [page] };
};

const pageTransition = (_baseEl: HTMLElement, opts?: { direction?: string; enteringEl?: HTMLElement; leavingEl?: HTMLElement }): Animation => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enteringEl = opts?.enteringEl;
  const leavingEl = opts?.leavingEl;

  // Tab-to-tab slides follow bottom-nav order (Movies -> Home slides back even
  // though it is a push); everything else follows the router direction.
  const from = tabIndex(leavingEl);
  const to = tabIndex(enteringEl);
  const forward = from >= 0 && to >= 0 ? to > from : opts?.direction !== 'back';
  const offset = (pct: number) => `translateX(${reduceMotion ? 0 : forward ? pct : -pct}%)`;

  const root = createAnimation('page-transition')
    .duration(TRANSITION_MS)
    .easing('cubic-bezier(0.2, 0, 0, 1)');

  if (enteringEl) {
    const { fade, slide } = pageParts(enteringEl);
    // Always stack the entering page on top so its nav covers the leaving one, even on back.
    root
      .addElement(enteringEl)
      .beforeRemoveClass('ion-page-invisible')
      .beforeStyles({ 'z-index': '102' });
    root.addAnimation(createAnimation().addElement(fade).fromTo('opacity', '0', '1'));
    root.addAnimation(createAnimation().addElement(slide).fromTo('transform', offset(6), 'translateX(0)'));

    const activeIcon = enteringEl.querySelector<HTMLElement>('.bottom-nav__item--active ion-icon');
    if (activeIcon && from >= 0 && from !== to && !reduceMotion) {
      root.addAnimation(
        createAnimation()
          .addElement(activeIcon)
          .easing('cubic-bezier(0.34, 1.56, 0.64, 1)')
          .fromTo('transform', 'scale(0.8)', 'scale(1)')
      );
    }
  }

  if (leavingEl) {
    root.addAnimation(
      createAnimation()
        .addElement(pageParts(leavingEl).slide)
        .duration(TRANSITION_MS * 0.6)
        .fromTo('opacity', '1', '0')
        .fromTo('transform', 'translateX(0)', offset(-3))
    );
  }

  return root;
};

/*
 * Android hardware back. Registering a Capacitor backButton listener makes the
 * plugin emit the `backbutton` event Ionic routes on, so the outlet pops the
 * stack with the back transition. A tab with nothing left to pop returns to
 * Home; on Home (or any other root) the app is sent to the background like a
 * native Android root screen.
 */
const TAB_PATHS = ['/movies', '/tickets', '/history', '/profile'];

const HardwareBackButton: React.FC = () => {
  const router = useIonRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const listener = CapacitorApp.addListener('backButton', () => {});
    const onBack = (ev: Event) => {
      (ev as CustomEvent).detail.register(10, (processNextHandler: () => void) => {
        const path = window.location.pathname;
        if (path !== '/home' && routerRef.current.canGoBack()) {
          processNextHandler();
        } else if (TAB_PATHS.includes(path)) {
          // A tab reached with a fresh history (e.g. Tickets after paying) backs out to Home.
          routerRef.current.push('/home', 'back');
        } else {
          CapacitorApp.minimizeApp();
        }
      });
    };
    document.addEventListener('ionBackButton', onBack);

    return () => {
      document.removeEventListener('ionBackButton', onBack);
      listener.then((l) => l.remove());
    };
  }, []);

  return null;
};

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <HardwareBackButton />
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
