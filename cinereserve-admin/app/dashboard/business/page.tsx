"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Armchair,
  Building2,
  CheckCircle2,
  Circle,
  DoorClosed,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { groupHours, type OperatingHours } from "@/lib/hours";

import { cn } from "@/lib/utils";

type BookingMode = "room" | "seat";
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Hours = OperatingHours;

type Branch = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string | null;
  phone: string | null;
  email: string | null;
  booking_mode: BookingMode;
  logo_url: string | null;
  photos: string[] | null;
  operating_hours: Hours | null;
  status: "draft" | "active" | "suspended";
  setup: Record<string, boolean>;
};

const DAYS: { key: Day; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const MODES: { mode: BookingMode; icon: typeof DoorClosed; title: string; body: string }[] = [
  { mode: "room", icon: DoorClosed, title: "By room", body: "A group rents the whole room for a screening." },
  { mode: "seat", icon: Armchair, title: "By seat", body: "Customers pick seats or benches in a shared screening." },
];

const SETUP_STEPS: Record<string, { label: string; href?: string }> = {
  profile: { label: "Business profile, logo and opening hours" },
  booking_mode: { label: "Booking model chosen" },
  rooms: { label: "At least one active room, every room priced", href: "/dashboard/screens" },
  seats: { label: "Seating layout for a room", href: "/dashboard/seats" },
  movies: { label: "At least one movie customers can pick", href: "/dashboard/movies" },
  schedules: { label: "At least one scheduled showing with a price", href: "/dashboard/schedules" },
};

const STATUS_STYLE: Record<Branch["status"], string> = {
  draft: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  suspended: "border-destructive/30 bg-destructive/10 text-destructive",
};

const EMPTY = {
  name: "",
  description: "",
  address: "",
  city: "",
  province: "",
  phone: "",
  email: "",
  booking_mode: "" as BookingMode | "",
};

type Form = typeof EMPTY;

/**
 * Business Profile and onboarding in one page: with no establishment it
 * registers one as a draft; otherwise it edits the current
 * establishment and shows what is left before it goes live by itself.
 */
export default function BusinessPage() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [hours, setHours] = useState<Hours>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "photo" | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const applyBranch = useCallback((next: Branch | null) => {
    setBranch(next);
    if (!next) return;
    setForm({
      name: next.name ?? "",
      description: next.description ?? "",
      address: next.address ?? "",
      city: next.city ?? "",
      province: next.province ?? "",
      phone: next.phone ?? "",
      email: next.email ?? "",
      booking_mode: next.booking_mode,
    });
    setHours(next.operating_hours ?? {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data) => applyBranch(data.user?.branch ?? null))
      .catch(() => setFormError("Unable to load your business. Try again."))
      .finally(() => setLoading(false));
  }, [applyBranch]);

  const isNew = !branch;

  const setDay = (day: Day, value: { open: string; close: string } | null) =>
    setHours((h) => {
      const next = { ...h };
      if (value) next[day] = value;
      else delete next[day];
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.booking_mode) {
      setErrors({ booking_mode: "Choose how customers book." });
      return;
    }
    setSaving(true);
    setErrors({});
    setFormError(null);

    try {
      const res = await fetch(isNew ? "/api/admin/branches" : "/api/admin/branch", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          province: form.province || null,
          phone: form.phone || null,
          email: form.email || null,
          operating_hours: hours,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422 && data.errors) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(data.errors as Record<string, string[]>)) {
          next[key.startsWith("operating_hours") ? "operating_hours" : key] = messages[0];
        }
        setErrors(next);
        setFormError(data.message ?? "Check the highlighted fields and try again.");
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        applyBranch(data.branch);
        toast.success(isNew ? "Establishment registered as a draft." : "Business profile saved.");
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: "logo" | "photo", file: File) => {
    setUploading(kind);
    try {
      const body = new FormData();
      body.append(kind, file);
      const res = await fetch(kind === "logo" ? "/api/admin/branch/logo" : "/api/admin/branch/photos", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.errors?.[kind]?.[0] ?? data.message ?? "Upload failed. Try again.");
      else {
        applyBranch(data.branch);
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      toast.error("Unable to reach the server. Try again.");
    } finally {
      setUploading(null);
    }
  };

  const removePhoto = async (url: string) => {
    const res = await fetch("/api/admin/branch/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) applyBranch(data.branch);
    else toast.error(data?.message ?? "Could not remove the photo.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const text = (name: keyof Omit<Form, "booking_mode">, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div className={cn("flex flex-col gap-1.5", props.className)}>
      <Label htmlFor={`business-${name}`}>{label}</Label>
      <Input
        {...props}
        id={`business-${name}`}
        className="h-11"
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        aria-invalid={Boolean(errors[name])}
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 rounded-2xl bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">
            {isNew ? "Register your mini cinema" : "Business information"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? "Your establishment starts as a draft and goes live on its own once setup is complete. No approval needed."
              : "This is what customers see in the CineReserve app."}
          </p>
        </div>

        {formError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Business name", { className: "sm:col-span-2", placeholder: "Starlight Mini Cinema" })}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="business-description">Description</Label>
            <textarea
              id="business-description"
              rows={3}
              maxLength={2000}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Cozy private rooms for movie nights, birthdays and barkadas."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>
          {text("address", "Address", { className: "sm:col-span-2", autoComplete: "street-address" })}
          {text("city", "City", { autoComplete: "address-level2" })}
          {text("province", "Province (optional)", { autoComplete: "address-level1" })}
          {text("phone", "Contact number", { type: "tel" })}
          {text("email", "Business email", { type: "email" })}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Category</Label>
            <p className="rounded-xl border border-input px-3 py-2.5 text-sm text-muted-foreground">Mini Cinema</p>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">How do customers book?</legend>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
            {MODES.map(({ mode, icon: Icon, title, body }) => {
              const checked = form.booking_mode === mode;
              const locked = !isNew && branch?.status !== "draft";
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={locked && !checked}
                  onClick={() => setForm((f) => ({ ...f, booking_mode: mode }))}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-40",
                    checked ? "border-primary bg-primary/10" : "border-input hover:bg-muted/50"
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-xs text-muted-foreground">{body}</span>
                  </span>
                  {checked ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
          {!isNew && branch?.status !== "draft" && (
            <p className="text-xs text-muted-foreground">The booking model is locked once the establishment is live.</p>
          )}
          {errors.booking_mode && <p className="text-xs text-destructive">{errors.booking_mode}</p>}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Operating hours</legend>
          {DAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div key={key} className="grid grid-cols-[7rem_1fr] items-center gap-3 sm:grid-cols-[8rem_auto_1fr]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(day)}
                    onChange={(e) => setDay(key, e.target.checked ? { open: "10:00", close: "22:00" } : null)}
                    className="accent-[var(--primary)]"
                  />
                  {label}
                </label>
                {day ? (
                  <div className="flex items-center gap-2">
                    <Input type="time" className="h-9 w-28" value={day.open} onChange={(e) => setDay(key, { ...day, open: e.target.value })} aria-label={`${label} opens`} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" className="h-9 w-28" value={day.close} onChange={(e) => setDay(key, { ...day, close: e.target.value })} aria-label={`${label} closes`} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Closed</span>
                )}
              </div>
            );
          })}
          {errors.operating_hours && <p className="text-xs text-destructive">{errors.operating_hours}</p>}
          <div className="mt-2 rounded-xl border border-border/30 bg-background/40 p-4 text-sm">
            <p className="mb-2 font-semibold">Hours of Operation</p>
            <ul className="flex flex-col gap-1">
              {groupHours(hours).map(({ days, time }) => (
                <li key={days}>
                  <span className="font-medium">{days}:</span>{" "}
                  <span className="text-muted-foreground">{time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              A closing time earlier than the opening time means you close after midnight.
            </p>
          </div>
        </fieldset>

        <Button type="submit" disabled={saving} className="h-11 gap-2 self-start rounded-xl">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isNew ? "Register establishment" : "Save changes"}
        </Button>
      </form>

      {branch && (
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Setup</h2>
              <span className={cn("rounded-full border px-2 py-0.5 text-xs capitalize", STATUS_STYLE[branch.status])}>
                {branch.status}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              {branch.status === "active"
                ? "Your establishment is live and taking bookings."
                : branch.status === "suspended"
                  ? "The platform administrator has suspended this establishment. Customers can't book it."
                  : "Finish these steps and your establishment publishes itself."}
            </p>
            <ul className="flex flex-col gap-2.5">
              {Object.entries(branch.setup).map(([key, done]) => {
                const step = SETUP_STEPS[key];
                return (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {step?.href && !done ? (
                      <Link href={step.href} className="text-primary hover:underline">
                        {step.label}
                      </Link>
                    ) : (
                      <span className={done ? "text-muted-foreground" : ""}>{step?.label ?? key}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl bg-card p-5">
            <h2 className="mb-3 font-semibold">Logo</h2>
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              disabled={uploading !== null}
              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-muted text-primary disabled:opacity-60"
              aria-label="Change logo"
            >
              {branch.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branch.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8" />
              )}
              {uploading === "logo" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </span>
              )}
            </button>
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload("logo", file);
            }} />
          </section>

          <section className="rounded-2xl bg-card p-5">
            <h2 className="mb-3 font-semibold">Photos</h2>
            <div className="grid grid-cols-3 gap-2">
              {(branch.photos ?? []).map((url) => (
                <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(branch.photos?.length ?? 0) < 10 && (
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={uploading !== null}
                  className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:text-foreground"
                  aria-label="Add photo"
                >
                  {uploading === "photo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload("photo", file);
            }} />
          </section>
        </aside>
      )}
    </div>
  );
}
