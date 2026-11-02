"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  CalendarClock,
  ChartColumn,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Keys match the API's field names so server validation errors map 1:1.
type FieldName =
  | "branch_name"
  | "email"
  | "phone"
  | "password"
  | "password_confirmation";

type FormValues = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = {
  branch_name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  {
    icon: Armchair,
    title: "Private rooms or by seat",
    body: "Rent out whole rooms to groups, or sell individual seats per screening.",
  },
  {
    icon: CalendarClock,
    title: "Bookings without clashes",
    body: "Customers pick any movie and an open time; a room is never double-booked.",
  },
  {
    icon: ChartColumn,
    title: "Know your sales",
    body: "See bookings, payments and how full each screening is.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.branch_name.trim()) next.branch_name = "Enter your branch name.";
    if (!form.email.trim()) {
      next.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!form.phone.trim()) next.phone = "Enter your phone number.";
    if (form.password.length < 8) next.password = "Use at least 8 characters.";
    if (form.password_confirmation !== form.password) {
      next.password_confirmation = "Passwords don't match.";
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
      const res = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // New owners register their first establishment next.
        router.push("/dashboard/business");
        return;
      }

      if (res.status === 422 && data.errors) {
        const serverErrors: FormErrors = {};
        for (const [field, messages] of Object.entries(data.errors as Record<string, string[]>)) {
          serverErrors[field as FieldName] = messages[0];
        }
        setErrors(serverErrors);
      }
      setFormError(
        res.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : (data.message ?? "Something went wrong. Try again.")
      );
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const field = (
    name: FieldName,
    label: string,
    icon: LucideIcon,
    props: React.ComponentProps<"input"> = {}
  ) => {
    const Icon = icon;
    const isPassword = name === "password" || name === "password_confirmation";
    const id = `register-${name}`;

    return (
      <div className={cn("flex flex-col gap-1.5", props.className)}>
        <Label htmlFor={id}>
          {label}
        </Label>
        <div className="relative flex items-center">
          <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input
            {...props}
            id={id}
            type={isPassword ? (showPassword ? "text" : "password") : (props.type ?? "text")}
            className={cn("h-12 pl-10", isPassword && name === "password" && "pr-10")}
            value={form[name]}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
            aria-invalid={Boolean(errors[name])}
            aria-describedby={`${id}-error`}
          />
          {name === "password" && (
            <button
              type="button"
              className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide passwords" : "Show passwords"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {errors[name] && (
          <p
            id={`${id}-error`}
            className="flex items-center gap-1.5 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground lg:flex-row">
      {/* Landing panel */}
      <section className="relative flex w-full flex-col justify-between overflow-hidden bg-card p-6 sm:p-10 lg:sticky lg:top-0 lg:h-screen lg:w-[55%] lg:p-12">
        <div className="absolute inset-0">
          <img src="/background.png" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-card/40" />
          <div className="absolute inset-0 bg-card/30 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10">
          <Link href="/" aria-label="CineReserve AI home" className="inline-block">
            <img src="/logo.png" alt="CineReserve AI" className="h-12 w-auto drop-shadow-lg lg:h-20" />
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-xl py-10 lg:py-12">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1 text-secondary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold tracking-wider uppercase">For mini cinema owners</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Run your mini cinema on{" "}
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#d2bbff] bg-clip-text text-transparent">
              CineReserve AI
            </span>
          </h1>
          <p className="max-w-lg leading-relaxed text-muted-foreground">
            Put your rooms, seats and movies online so customers can book
            and pay from the CineReserve app. No more taking reservations over
            chat. Set up your account in a few minutes.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 hidden border-t border-border/20 pt-6 lg:block">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground/80 uppercase">
            Next-Gen Cinema Intelligence
          </span>
        </div>
      </section>

      {/* Signup panel */}
      <section className="relative flex w-full flex-col items-center justify-center bg-background p-6 sm:p-10 lg:w-[45%] lg:p-14">
        <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl sm:p-10">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Create your account
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Step 1 of 2. Next you&apos;ll finish your branch profile.
            </p>
          </div>

          {formError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle />
              <AlertTitle>Sign-up failed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form className="flex flex-col gap-8" onSubmit={handleSubmit} noValidate>
            <fieldset className="grid gap-5 sm:grid-cols-2">
              <legend className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Your mini cinema account
              </legend>
              {field("branch_name", "Branch name", Store, {
                className: "sm:col-span-2",
                autoComplete: "organization",
                placeholder: "Starlight Mini Cinema",
              })}
              {field("email", "Work email", Mail, {
                type: "email",
                autoComplete: "email",
                placeholder: "maria@starlight.com",
              })}
              {field("phone", "Phone", Phone, {
                type: "tel",
                autoComplete: "tel",
                placeholder: "+63 912 345 6789",
              })}
              {field("password", "Password", Lock, {
                autoComplete: "new-password",
                placeholder: "At least 8 characters",
              })}
              {field("password_confirmation", "Confirm password", Lock, {
                autoComplete: "new-password",
                placeholder: "Repeat password",
              })}
            </fieldset>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 gap-2 rounded-xl text-sm font-semibold shadow-lg shadow-primary/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up your cinema…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
