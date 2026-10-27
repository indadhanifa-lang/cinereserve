import { useState } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonPage,
  useIonRouter,
} from "@ionic/react";
import {
  alertCircleOutline,
  arrowForwardOutline,
  callOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { navigate } from "../lib/nav";
import { apiPost } from "../lib/api";
import "./Register.css";

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface Banner {
  type: "success" | "error";
  message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,}$/;

const Register: React.FC = () => {
  const ionRouter = useIonRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!fullName.trim()) {
      next.fullName = "Enter your full name.";
    }
    if (!email.trim()) {
      next.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (!phone.trim()) {
      next.phone = "Enter your mobile number.";
    } else if (!PHONE_PATTERN.test(phone)) {
      next.phone = "Enter a valid mobile number.";
    }
    if (!password) {
      next.password = "Create a password.";
    } else if (password.length < 8) {
      next.password = "Use at least 8 characters.";
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setBanner({
        type: "error",
        message: "Please ensure all fields are valid.",
      });
      return;
    }
    if (loading) return;

    setBanner(null);
    setLoading(true);

    try {
      await apiPost("/register", {
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      setBanner({
        type: "success",
        message: "Account created! Redirecting to sign in…",
      });

      setTimeout(() => navigate(ionRouter, "/login"), 1500);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string; errors?: Record<string, string[]> };

      if (apiErr.status === 422 && apiErr.errors) {
        const serverErrors: FormErrors = {};
        if (apiErr.errors.email) serverErrors.email = apiErr.errors.email[0];
        if (apiErr.errors.name) serverErrors.fullName = apiErr.errors.name[0];
        if (apiErr.errors.phone) serverErrors.phone = apiErr.errors.phone[0];
        if (apiErr.errors.password) serverErrors.password = apiErr.errors.password[0];
        setErrors(serverErrors);
        setBanner({
          type: "error",
          message: apiErr.message || "Please fix the errors below.",
        });
      } else {
        setBanner({
          type: "error",
          message: apiErr.message || "Something went wrong. Try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading ||
    !fullName.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !password;

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="reg-content">
        <div className="reg-page">
          <div className="reg-glow" aria-hidden="true" />
          <div className="reg-glow-right" aria-hidden="true" />

          <header className="reg-header">
            <div className="reg-logo-wrap">
              <img src="/logo.png" alt="CineReserve AI" className="reg-logo" />
            </div>
            <h1 className="reg-heading">Create Account</h1>
            <p className="reg-subtext">
              Join CineReserve to book movies and reserve seats
            </p>
          </header>

          {banner && banner.type === "error" && (
            <div className="reg-banner reg-banner--error" role="alert">
              <IonIcon icon={alertCircleOutline} className="reg-banner-icon" />
              <div className="reg-banner-body">
                <p className="reg-banner-title">Registration Incomplete</p>
                <p className="reg-banner-msg">{banner.message}</p>
              </div>
            </div>
          )}

          {banner && banner.type === "success" && (
            <div className="reg-banner reg-banner--success" role="status">
              <div className="reg-banner-success-icon">
                <IonIcon icon={shieldCheckmarkOutline} />
              </div>
              <div className="reg-banner-body">
                <p className="reg-banner-title">VIP Pass Ready!</p>
                <p className="reg-banner-msg">{banner.message}</p>
              </div>
            </div>
          )}

          <form className="reg-card" onSubmit={handleSubmit} noValidate>
            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-name">Full Name</label>
              <div className={`reg-input-row${errors.fullName ? " reg-input-row--error" : ""}`}>
                <IonIcon icon={personOutline} className="reg-input-icon" />
                <IonInput
                  id="reg-name"
                  type="text"
                  autocomplete="name"
                  placeholder="Alex Rivera"
                  className="reg-input"
                  value={fullName}
                  onIonInput={(e) => setFullName(e.detail.value ?? "")}
                />
              </div>
              {errors.fullName && (
                <p className="reg-error" role="alert">{errors.fullName}</p>
              )}
            </div>

            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-email">Email Address</label>
              <div className={`reg-input-row${errors.email ? " reg-input-row--error" : ""}`}>
                <IonIcon icon={mailOutline} className="reg-input-icon" />
                <IonInput
                  id="reg-email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder="alex.rivera@example.com"
                  className="reg-input"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? "")}
                />
              </div>
              {errors.email && (
                <p className="reg-error" role="alert">{errors.email}</p>
              )}
            </div>

            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-phone">Phone Number</label>
              <div className={`reg-input-row${errors.phone ? " reg-input-row--error" : ""}`}>
                <IonIcon icon={callOutline} className="reg-input-icon" />
                <IonInput
                  id="reg-phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="+63 912 345 6789"
                  className="reg-input"
                  value={phone}
                  onIonInput={(e) => setPhone(e.detail.value ?? "")}
                />
              </div>
              {errors.phone && (
                <p className="reg-error" role="alert">{errors.phone}</p>
              )}
            </div>

            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-password">Password</label>
              <div className={`reg-input-row${errors.password ? " reg-input-row--error" : ""}`}>
                <IonIcon icon={lockClosedOutline} className="reg-input-icon" />
                <IonInput
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  autocomplete="new-password"
                  placeholder="••••••••••••"
                  className="reg-input"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? "")}
                />
                <button
                  type="button"
                  className="reg-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                </button>
              </div>
              {errors.password && (
                <p className="reg-error" role="alert">{errors.password}</p>
              )}
            </div>

            <div className="reg-submit-wrap">
              <button
                type="submit"
                className="reg-submit-btn"
                disabled={isDisabled}
              >
                <span className="reg-submit-text">
                  {loading ? "Generating VIP Profile..." : "Create Account"}
                </span>
                {!loading && <IonIcon icon={arrowForwardOutline} className="reg-submit-icon" />}
                {loading && <span className="reg-spinner" />}
              </button>
            </div>
          </form>

          <div className="reg-switch">
            <span>Already have an account? </span>
            <IonButton
              fill="clear"
              onClick={() => navigate(ionRouter, "/login")}
              className="reg-link-signin"
            >
              Sign In
            </IonButton>
          </div>

          <div className="reg-footer">
            <p className="reg-footer__legal">
              By continuing, you agree to CineReserve AI&apos;s{' '}
              <IonButton fill="clear" className="footer-link">Terms</IonButton>
              {' '}&amp;{' '}
              <IonButton fill="clear" className="footer-link">Privacy Policy</IonButton>
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Register;
