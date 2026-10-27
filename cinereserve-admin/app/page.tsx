"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FormErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!email.trim()) {
      next.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (!password) {
      next.password = "Enter your password.";
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFormError("Check the highlighted fields and try again.");
      return;
    }
    if (loading) return;

    setFormError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setErrors({ password: data.message });
        setFormError(data.message);
      } else if (res.status === 403) {
        setFormError(data.message);
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        router.push("/dashboard");
        return;
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground lg:flex-row">
      {/* Brand & operations panel */}
      <section className="relative hidden w-full flex-col justify-between overflow-hidden bg-card p-12 lg:flex lg:w-[58%]">
        <div className="absolute inset-0">
          <img
            src="/background.png"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-card/40" />
          <div className="absolute inset-0 bg-card/30 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="CineReserve AI"
              className="h-20 w-auto drop-shadow-lg"
            />
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-xl py-12">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
            Autonomous Cinema Operations &amp; <br />
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#d2bbff] bg-clip-text text-transparent">
              Seating
            </span>
          </h1>
          <p className="max-w-lg leading-relaxed text-muted-foreground">
            Empowering premier exhibition circuits worldwide with real-time
            auditorium telemetry, autonomous revenue pacing, and seamless screen
            synchronization.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-border/20 pt-6 text-sm text-muted-foreground">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
            Next-Gen Cinema Intelligence
          </span>
          <span className="text-xs">
            Assigned clearance resolved on authentication
          </span>
        </div>
      </section>

      {/* Auth panel */}
      <section className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background p-6 sm:p-10 lg:w-[42%] lg:p-14">
        <div className="relative w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl sm:p-10">
          <div className="mb-6">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1 text-secondary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tracking-wider uppercase">
                Admin Portal
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome Back
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to manage your assigned cinema branch.
            </p>
          </div>

          {formError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle />
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form
            className="flex flex-col gap-5"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-email">Email Address</Label>
                <span className="text-xs text-muted-foreground">
                  Enterprise ID
                </span>
              </div>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  placeholder="alex.chen@cinereserve.com"
                  className="h-12 px-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby="admin-email-error"
                />
                {!errors.email && EMAIL_PATTERN.test(email) && (
                  <CheckCircle2 className="pointer-events-none absolute right-3 h-4 w-4 text-primary" />
                )}
              </div>
              {errors.email && (
                <p
                  id="admin-email-error"
                  className="flex items-center gap-1.5 text-xs text-destructive"
                  role="alert"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password">Password</Label>
                <span className="text-xs text-muted-foreground">
                  Audited entry
                </span>
              </div>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 pr-10 pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby="admin-password-error"
                />
                <button
                  type="button"
                  className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  id="admin-password-error"
                  className="flex items-center gap-1.5 text-xs text-destructive"
                  role="alert"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label
                htmlFor="remember-me"
                className="cursor-pointer gap-2.5 font-normal text-muted-foreground"
              >
                <Checkbox
                  id="remember-me"
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                />
                Remember me
              </Label>
              <button
                type="button"
                className="text-sm font-medium text-primary transition-colors hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "h-12 gap-2 rounded-xl text-sm font-semibold shadow-lg shadow-primary/30",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating branch ops…
                </>
              ) : (
                <>
                  Sign in to admin portal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="-mx-8 mt-8 rounded-b-2xl bg-muted/30 px-8 pt-5 sm:-mx-10 sm:px-10">
            <div className="flex items-start gap-2 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed">
                Authorized administrators only. IP logging and session auditing
                are enabled. Unauthorized access attempts are monitored and
                recorded.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center lg:hidden">
          <div className="mb-2 flex items-center justify-center">
            <img src="/logo.png" alt="CineReserve AI" className="h-8 w-auto" />
          </div>
          <p className="text-xs text-muted-foreground">
            v2.4 production cluster · Multi-screen security
          </p>
        </div>
      </section>
    </div>
  );
}
