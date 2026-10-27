"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, Loader2, Mail, Phone, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormErrors = { name?: string; email?: string; phone?: string };

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data) => {
        setName(data.user?.name ?? "");
        setEmail(data.user?.email ?? "");
        setPhone(data.user?.phone ?? "");
        setAvatarUrl(data.user?.avatar_url ?? null);
      })
      .catch(() => setFormError("Unable to load your profile. Try again."))
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      const body = new FormData();
      body.append("avatar", file);
      const res = await fetch("/api/admin/profile/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAvatarError(data.message ?? "Could not upload avatar. Try again.");
      } else {
        setAvatarUrl(data.user.avatar_url);
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      setAvatarError("Unable to reach the server. Try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of ["name", "email", "phone"] as const) {
          if (data.errors?.[key]?.[0]) fieldErrors[key] = data.errors[key][0];
        }
        setErrors(fieldErrors);
        setFormError("Check the highlighted fields and try again.");
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        setName(data.user.name);
        setEmail(data.user.email);
        setPhone(data.user.phone ?? "");
        toast.success("Your profile has been updated.");
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/dashboard/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Settings</span>
      </Link>

      <div className="rounded-2xl border border-border/30 bg-card p-5 sm:p-8">
        <h1 className="mb-1 text-xl font-bold text-foreground">Admin Profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Update your own name, email, and contact number.
        </p>

        {formError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertTitle>Update failed</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading your profile…</span>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-primary"
                  aria-label="Change avatar"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-7 w-7" />
                  )}
                  {uploadingAvatar && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </span>
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Profile photo</p>
                <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Up to 2MB.</p>
                {avatarError && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {avatarError}
                  </p>
                )}
              </div>
            </div>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <div className="relative flex items-center">
                <UserIcon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-name"
                  className="h-11 pl-10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
              </div>
              {errors.name && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-email">Email Address</Label>
              <div className="relative flex items-center">
                <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  className="h-11 pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-phone">Phone</Label>
              <div className="relative flex items-center">
                <Phone className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="Optional"
                  className="h-11 pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={Boolean(errors.phone)}
                />
              </div>
              {errors.phone && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.phone}
                </p>
              )}
            </div>

            <Button type="submit" disabled={saving} className="h-11 gap-2 self-start rounded-xl">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
