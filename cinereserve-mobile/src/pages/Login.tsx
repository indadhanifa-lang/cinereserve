import { useState } from 'react';
import { IonButton, IonCheckbox, IonContent, IonIcon, IonInput, IonPage, useIonRouter } from '@ionic/react';
import {
  arrowForwardOutline,
  eyeOffOutline,
  eyeOutline,
  informationCircleOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { apiPost, setToken } from '../lib/api';
import { navigate } from '../lib/nav';
import './AuthForm.css';

interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
}

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login: React.FC = () => {
  const ionRouter = useIonRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!email.trim()) {
      next.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = 'Enter your password.';
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setBanner(null);
    if (Object.keys(nextErrors).length > 0 || loading) return;

    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>('/customer/login', {
        email: email.trim(),
        password,
      });
      setToken(res.token, remember);
      navigate(ionRouter, '/home');
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr.status === 403) {
        setBanner(apiErr.message || 'Your account is inactive.');
      } else {
        setBanner(apiErr.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setBanner(
      email.trim()
        ? `A reset link has been sent to ${email.trim()}.`
        : 'Enter your email above, then tap this link to receive a reset link.'
    );
  };

  const isDisabled = loading || !email.trim() || !password;

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="auth-content">
        <div className="auth-page">
          <div className="auth-glow" aria-hidden="true" />

          <div className="login-header">
            <div className="brand-icon-wrap">
              <img src="/logo.png" alt="CineReserve AI" className="brand-logo" />
            </div>
            <h1 className="auth-heading">Welcome Back</h1>
            <p className="auth-subtext">Sign in to your CineReserve account</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label">Email Address</label>
              <div className={`input-row${errors.email ? ' input-row--error' : ''}`}>
                <IonIcon icon={mailOutline} className="input-row__icon" />
                <IonInput
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder="alex.rivera@example.com"
                  className="input-row__field"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                />
              </div>
              {errors.email && <p className="field__error">{errors.email}</p>}
            </div>

            <div className="field">
              <label className="field__label">Password</label>
              <div className={`input-row${errors.password ? ' input-row--error' : ''}`}>
                <IonIcon icon={lockClosedOutline} className="input-row__icon" />
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  autocomplete="current-password"
                  placeholder="••••••••••••"
                  className="input-row__field"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? '')}
                />
                <IonButton
                  fill="clear"
                  className="input-row__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  <IonIcon slot="icon-only" icon={showPassword ? eyeOutline : eyeOffOutline} />
                </IonButton>
              </div>
              {errors.password && <p className="field__error">{errors.password}</p>}
            </div>

            <div className="auth-options">
              <IonCheckbox
                className="checkbox"
                checked={remember}
                labelPlacement="end"
                justify="start"
                onIonChange={(e) => setRemember(e.detail.checked)}
              >
                Remember me
              </IonCheckbox>
              <IonButton fill="clear" className="link-forgot" onClick={handleForgotPassword}>
                Forgot Password?
              </IonButton>
            </div>

            {banner && (
              <div className="auth-banner" role="status">
                <IonIcon icon={informationCircleOutline} />
                <span>{banner}</span>
              </div>
            )}

            <div className="submit-wrap">
              <IonButton type="submit" expand="block" className="submit-button" disabled={isDisabled}>
                {loading ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <IonIcon icon={arrowForwardOutline} />
                  </>
                )}
              </IonButton>
            </div>

            <div className="auth-switch">
              <span>Don&apos;t have an account?</span>
              <IonButton fill="clear" onClick={() => navigate(ionRouter, '/register')}>
                Create Account
              </IonButton>
            </div>
          </form>

          <div className="login-footer">
            <p className="login-footer__legal">
              By continuing, you agree to CineReserve AI&apos;s{' '}
              <button type="button" className="footer-link">Terms</button>
              {' '}&amp;{' '}
              <button type="button" className="footer-link">Privacy Policy</button>
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
