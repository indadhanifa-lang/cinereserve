"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirmation) return setError("Passwords don't match.");
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.get("token") ?? "",
          email: params.get("email") ?? "",
          password,
          password_confirmation: confirmation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/login");
        return;
      }
      setError(
        res.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : (data.message ?? "Something went wrong. Try again.")
      );
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {[
        { id: "reset-password", label: "New password", value: password, set: setPassword },
        { id: "reset-confirm", label: "Confirm new password", value: confirmation, set: setConfirmation },
      ].map(({ id, label, value, set }) => (
        <div key={id} className="flex flex-col gap-1.5">
          <Label htmlFor={id}>{label}</Label>
          <div className="relative flex items-center">
            <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              className="h-12 pl-10"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        </div>
      ))}
      <Button type="submit" disabled={loading} className="h-12 gap-2 rounded-xl font-semibold">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Reset password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl sm:p-10">
        <Link href="/" aria-label="CineReserve AI home" className="inline-block">
          <img src="/logo.png" alt="CineReserve AI" className="mb-6 h-10 w-auto" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Signing in again is required on every device afterwards.
        </p>
        {/* useSearchParams needs a Suspense boundary for static rendering. */}
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
