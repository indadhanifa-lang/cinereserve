"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, Building2, Loader2, Mail, MapPin, Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormErrors = { name?: string; address?: string; city?: string; province?: string; phone?: string; email?: string };

export default function BranchProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noBranch, setNoBranch] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data) => {
        const branch = data.user?.branch;
        if (!branch) {
          setNoBranch(true);
          return;
        }
        setName(branch.name ?? "");
        setAddress(branch.address ?? "");
        setCity(branch.city ?? "");
        setProvince(branch.province ?? "");
        setPhone(branch.phone ?? "");
        setEmail(branch.email ?? "");
        setLogoUrl(branch.logo_url ?? null);
      })
      .catch(() => setFormError("Unable to load your branch. Try again."))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingLogo(true);
    setLogoError(null);

    try {
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch("/api/admin/branch/logo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLogoError(data.message ?? "Could not upload logo. Try again.");
      } else {
        setLogoUrl(data.branch.logo_url);
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      setLogoError("Unable to reach the server. Try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    try {
      const res = await fetch("/api/admin/branch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          city,
          province: province || null,
          phone: phone || null,
          email: email || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of ["name", "address", "city", "province", "phone", "email"] as const) {
          if (data.errors?.[key]?.[0]) fieldErrors[key] = data.errors[key][0];
        }
        setErrors(fieldErrors);
        setFormError("Check the highlighted fields and try again.");
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        setName(data.branch.name);
        setAddress(data.branch.address);
        setCity(data.branch.city);
        setProvince(data.branch.province ?? "");
        setPhone(data.branch.phone ?? "");
        setEmail(data.branch.email ?? "");
        toast.success("Branch profile has been updated.");
        window.dispatchEvent(new Event("admin-profile-updated"));
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/dashboard/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Settings</span>
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
      <div className="rounded-2xl border border-border/30 bg-card p-5 sm:p-6">
        <h1 className="mb-1 text-xl font-bold text-foreground">Branch Profile</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Cinema address and contact points for this branch.
        </p>

        {formError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertTitle>Update failed</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading branch…</span>
          </div>
        ) : noBranch ? (
          <p className="text-sm text-muted-foreground">
            No branch is assigned to your account yet. Contact a super admin.
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-name">Branch Name</Label>
              <div className="relative flex items-center">
                <Store className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="branch-name"
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
              <Label htmlFor="branch-address">Address</Label>
              <div className="relative flex items-center">
                <MapPin className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                <textarea
                  id="branch-address"
                  rows={2}
                  className="flex w-full rounded-xl border border-input bg-background py-2.5 pr-3 pl-10 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  aria-invalid={Boolean(errors.address)}
                />
              </div>
              {errors.address && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.address}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-city">City</Label>
                <Input
                  id="branch-city"
                  className="h-11"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.city}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-province">Province</Label>
                <Input
                  id="branch-province"
                  placeholder="Optional"
                  className="h-11"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  aria-invalid={Boolean(errors.province)}
                />
                {errors.province && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.province}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-phone">Phone</Label>
                <div className="relative flex items-center">
                  <Phone className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="branch-phone"
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-email">Email</Label>
                <div className="relative flex items-center">
                  <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="branch-email"
                    type="email"
                    placeholder="Optional"
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
        )}
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/30 bg-card p-5 text-center">
        <p className="self-start text-sm font-medium text-foreground">Branch Logo</p>
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo || loading || noBranch}
          className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-muted text-primary disabled:opacity-60"
          aria-label="Change branch logo"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-9 w-9" />
          )}
          {uploadingLogo && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </button>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoChange}
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Up to 2MB.</p>
        {logoError && (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="h-3.5 w-3.5" />
            {logoError}
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
