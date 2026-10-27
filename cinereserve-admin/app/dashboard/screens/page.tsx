"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil, SquarePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusSwitch } from "@/components/dashboard/status-switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_STATES } from "@/lib/dashboard-nav";

type Screen = {
  id: number;
  name: string;
  screen_type: string | null;
  capacity: number;
  status: string;
};

type FormErrors = Partial<Record<"name" | "screen_type" | "capacity" | "status", string>>;

const EMPTY_FORM = { name: "", screen_type: "", capacity: "", status: "active" };

export default function ScreensPage() {
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadScreens = (silent = false) => {
    fetch("/api/admin/screens")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message ?? "Unable to load screens. Try again.");
        }
        setScreens(data.screens ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load screens. Try again.";
        if (silent) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      });
  };

  useEffect(() => loadScreens(), []);

  const openModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (screen: Screen) => {
    setEditing(screen);
    setForm({
      name: screen.name,
      screen_type: screen.screen_type ?? "",
      capacity: String(screen.capacity),
      status: screen.status,
    });
    setErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    const capacity = Number(form.capacity);
    const clientErrors: FormErrors = {};
    if (!name) clientErrors.name = "Screen name is required.";
    else if (name.length > 100) clientErrors.name = "Screen name must be 100 characters or fewer.";
    if (!form.capacity.trim()) clientErrors.capacity = "Capacity is required.";
    else if (!Number.isInteger(capacity) || capacity < 1) {
      clientErrors.capacity = "Capacity must be a whole number of at least 1.";
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const isEdit = editing !== null;
    const endpoint = editing ? `/api/admin/screens/${editing.id}` : "/api/admin/screens";

    try {
      const res = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          screen_type: form.screen_type.trim() || null,
          capacity,
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of ["name", "screen_type", "capacity", "status"] as const) {
          if (data.errors?.[key]?.[0]) fieldErrors[key] = data.errors[key][0];
        }
        setErrors(fieldErrors);
        setFormError("Check the highlighted fields and try again.");
        return;
      }

      if (!res.ok) {
        setFormError(
          data.message ??
            (isEdit ? "Unable to update the screen. Try again." : "Unable to add the screen. Try again.")
        );
        return;
      }

      const screenName: string = data.screen?.name ?? name;

      setForm(EMPTY_FORM);
      setEditing(null);
      setModalOpen(false);

      if (isEdit) {
        loadScreens(true);
        toast.success(`Screen "${screenName}" updated.`);
      } else {
        setScreens((prev) => [...(prev ?? []), data.screen]);
        toast.success(`Screen "${screenName}" created.`);
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  // Optimistic flip via the existing full-row PATCH; reverted if the server rejects it.
  const toggleStatus = async (screen: Screen) => {
    const next = screen.status === "active" ? "inactive" : "active";
    const setStatus = (status: string) =>
      setScreens((prev) =>
        prev ? prev.map((s) => (s.id === screen.id ? { ...s, status } : s)) : prev
      );

    setTogglingId(screen.id);
    setStatus(next);
    try {
      const res = await fetch(`/api/admin/screens/${screen.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: screen.name,
          screen_type: screen.screen_type,
          capacity: screen.capacity,
          status: next,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      toast.success(`Screen "${screen.name}" is now ${next}.`);
    } catch (err) {
      setStatus(screen.status);
      toast.error(err instanceof Error && err.message ? err.message : "Could not update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = (screens ?? []).filter((screen) => screen.status === "active").length;

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? (
      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertCircle className="h-3.5 w-3.5" />
        {errors[key]}
      </p>
    ) : null;

  const modal = modalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !saving && setModalOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-screen-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-screen-title" className="text-base font-semibold text-foreground">
            {editing ? "Edit Screen" : "Add Screen"}
          </h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <p
            className="mb-4 flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {formError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screen-name">Screen Name</Label>
            <Input
              id="screen-name"
              autoFocus
              className="h-11"
              placeholder="Screen 1"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              aria-invalid={Boolean(errors.name)}
              disabled={saving}
            />
            {fieldError("name")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screen-type">Screen Type</Label>
            <Input
              id="screen-type"
              className="h-11"
              placeholder="2D"
              maxLength={50}
              value={form.screen_type}
              onChange={(e) => setForm((prev) => ({ ...prev, screen_type: e.target.value }))}
              aria-invalid={Boolean(errors.screen_type)}
              disabled={saving}
            />
            {fieldError("screen_type")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screen-capacity">Capacity</Label>
            <Input
              id="screen-capacity"
              type="number"
              min={1}
              step={1}
              className="h-11"
              placeholder="40"
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
              aria-invalid={Boolean(errors.capacity)}
              disabled={saving}
            />
            {fieldError("capacity")}
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving} className="h-10 gap-2 rounded-full px-4">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Screen"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  if (loadError) {
    return (
      <>
        <p className="text-sm text-destructive">{loadError}</p>
        {modal}
      </>
    );
  }

  if (screens === null) {
    return (
      <>
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading screens…</span>
        </div>
        {modal}
      </>
    );
  }

  if (screens.length === 0) {
    return (
      <>
        <EmptyState
          {...EMPTY_STATES.screens}
          cta={{ ...EMPTY_STATES.screens.cta!, onClick: openModal }}
        />
        {modal}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {activeCount} Active Screen{activeCount === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <SquarePlus className="h-4 w-4" />
          Add Screen
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Screen</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {screens.map((screen) => (
              <tr key={screen.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 font-semibold text-foreground">{screen.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{screen.screen_type || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{screen.capacity} seats</td>
                <td className="px-4 py-3">
                  <StatusSwitch
                    status={screen.status}
                    label={`${screen.name} status`}
                    disabled={togglingId === screen.id}
                    onToggle={() => void toggleStatus(screen)}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(screen)}
                    aria-label={`Edit ${screen.name}`}
                    title="Edit screen"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
