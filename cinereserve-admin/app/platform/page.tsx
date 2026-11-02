"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type Business = {
  id: number;
  name: string;
  category: string;
  city: string;
  booking_mode: "room" | "seat";
  status: "draft" | "active" | "suspended";
  owner: { id: number; name: string; email: string } | null;
};

const STATUS_STYLE: Record<Business["status"], string> = {
  draft: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  suspended: "border-destructive/30 bg-destructive/10 text-destructive",
};

/**
 * Platform administrator: every business on CineReserve. Businesses go live
 * on their own, so the only action here is suspending or reinstating one.
 */
export default function PlatformPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/platform/branches")
      .then(async (res) => {
        if (res.status === 401) return router.replace("/login");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Unable to load businesses.");
        setBusinesses(data.branches);
      })
      .catch((err: Error) => setError(err.message));
  }, [router]);

  const setStatus = async (business: Business, status: "active" | "suspended") => {
    setBusyId(business.id);
    try {
      const res = await fetch(`/api/platform/branches/${business.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      setBusinesses((prev) =>
        prev?.map((b) => (b.id === business.id ? { ...b, status: data.branch.status } : b)) ?? prev
      );
      toast.success(`${business.name} is now ${data.branch.status}.`);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Could not update the business.");
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
            <p className="text-sm text-muted-foreground">
              Every establishment on CineReserve. Suspended ones stop taking new bookings.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !businesses ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Booking</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {businesses.map((business) => (
                  <tr key={business.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{business.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {business.city} · {business.category === "mini_cinema" ? "Mini cinema" : "Cinema"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {business.owner ? (
                        <>
                          <p>{business.owner.name}</p>
                          <p className="text-xs">{business.owner.email}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {business.booking_mode === "room" ? "By room" : "By seat"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs capitalize", STATUS_STYLE[business.status])}>
                        {business.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === business.id}
                        onClick={() => setStatus(business, business.status === "suspended" ? "active" : "suspended")}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
                          business.status === "suspended"
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "border border-destructive/40 text-destructive hover:bg-destructive/10"
                        )}
                      >
                        {business.status === "suspended" ? "Reinstate" : "Suspend"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
