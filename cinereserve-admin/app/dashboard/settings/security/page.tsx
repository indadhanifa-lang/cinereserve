"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FieldName = "current_password" | "password" | "password_confirmation";
type FormErrors = Partial<Record<FieldName, string>>;

const FIELDS: { name: FieldName; id: string; label: string; autoComplete: string }[] = [
  { name: "current_password", id: "security-current", label: "Current Password", autoComplete: "current-password" },
  { name: "password", id: "security-new", label: "New Password", autoComplete: "new-password" },
  { name: "password_confirmation", id: "security-confirm", label: "Confirm New Password", autoComplete: "new-password" },
];

const EMPTY_VALUES: Record<FieldName, string> = {
  current_password: "",
  password: "",
  password_confirmation: "",
};

export default function AdminSecurityPage() {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [visible, setVisible] = useState<Record<FieldName, boolean>>({
    current_password: false,
    password: false,
    password_confirmation: false,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Catch the obvious mistakes before a round trip; the API re-validates.
    const clientErrors: FormErrors = {};
    if (!values.current_password) clientErrors.current_password = "Enter your current password.";
    if (values.password.length < 8) clientErrors.password = "Use at least 8 characters.";
    if (values.password !== values.password_confirmation) {
      clientErrors.password_confirmation = "Passwords do not match.";
    }
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const { name } of FIELDS) {
          if (data.errors?.[name]?.[0]) fieldErrors[name] = data.errors[name][0];
        }
        setErrors(fieldErrors);
        setFormError("Check the highlighted fields and try again.");
      } else if (res.status === 429) {
        setFormError("Too many attempts. Wait a minute and try again.");
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        setValues(EMPTY_VALUES);
        toast.success("Your password has been changed.");
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
        <h1 className="mb-1 text-xl font-bold text-foreground">Change Password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Changing your password signs you out of every other device. This session stays signed in.
        </p>

        {formError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle />
            <AlertTitle>Password not changed</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.id}>{field.label}</Label>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id={field.id}
                  type={visible[field.name] ? "text" : "password"}
                  autoComplete={field.autoComplete}
                  className="h-11 pr-10 pl-10"
                  value={values[field.name]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  aria-invalid={Boolean(errors[field.name])}
                />
                <button
                  type="button"
                  className="absolute right-3 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setVisible((prev) => ({ ...prev, [field.name]: !prev[field.name] }))}
                  aria-label={visible[field.name] ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                  aria-pressed={visible[field.name]}
                >
                  {visible[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors[field.name] && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors[field.name]}
                </p>
              )}
            </div>
          ))}

          <Button type="submit" disabled={saving} className="h-11 gap-2 self-start rounded-xl">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
