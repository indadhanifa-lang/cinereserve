"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Pencil, SquarePlus, X } from "lucide-react";
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
  rental_price: string | null;
  extra_guest_fee: string | null;
  photos: string[] | null;
  status: string;
};

const FIELDS = [
  "name",
  "screen_type",
  "capacity",
  "rental_price",
  "extra_guest_fee",
  "status",
] as const;

type FormErrors = Partial<Record<(typeof FIELDS)[number], string>>;

const EMPTY_FORM = {
  name: "",
  screen_type: "",
  capacity: "",
  rental_price: "",
  extra_guest_fee: "",
  status: "active",
};

/** Full-row body for create, edit and the status toggle. */
const screenBody = (screen: Pick<Screen, (typeof FIELDS)[number]>) =>
  JSON.stringify({
    name: screen.name,
    screen_type: screen.screen_type,
    capacity: screen.capacity,
    rental_price: screen.rental_price,
    extra_guest_fee: screen.extra_guest_fee,
    status: screen.status,
  });

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [seatMode, setSeatMode] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetch("/api/admin/me")
      .then((res) => res.json())
      .then((data) => setSeatMode(data.user?.branch?.booking_mode === "seat"))
      .catch(() => {});
  }, []);

  // By room: one price per booking (the whole room for one movie). By seat: the base price per seat.
  const priceLabel = seatMode ? "Price per Seat" : "Price per Booking";

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
      rental_price: screen.rental_price ?? "",
      extra_guest_fee: screen.extra_guest_fee ?? "",
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
    const hasFee = form.extra_guest_fee.trim() !== "";

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
        body: screenBody({
          name,
          screen_type: form.screen_type.trim() || null,
          capacity,
          rental_price: form.rental_price.trim() === "" ? null : form.rental_price,
          extra_guest_fee: hasFee ? form.extra_guest_fee : null,
          status: form.status,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of FIELDS) {
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
        toast.success(`Room "${screenName}" updated.`);
      } else {
        setScreens((prev) => [...(prev ?? []), data.screen]);
        toast.success(`Room "${screenName}" created.`);
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
        body: screenBody({ ...screen, status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      toast.success(`Room "${screen.name}" is now ${next}.`);
    } catch (err) {
      setStatus(screen.status);
      toast.error(err instanceof Error && err.message ? err.message : "Could not update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = (screens ?? []).filter((screen) => screen.status === "active").length;

  const updateScreen = (screen: Screen) => {
    setEditing(screen);
    setScreens((prev) => prev?.map((s) => (s.id === screen.id ? screen : s)) ?? prev);
  };

  const uploadPhoto = async (file: File) => {
    if (!editing) return;
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch(`/api/admin/screens/${editing.id}/photos`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) updateScreen(data.screen);
      else toast.error(data.errors?.photo?.[0] ?? data.message ?? "Upload failed. Try again.");
    } catch {
      toast.error("Unable to reach the server. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async (url: string) => {
    if (!editing) return;
    const res = await fetch(`/api/admin/screens/${editing.id}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) updateScreen(data.screen);
    else toast.error(data?.message ?? "Could not remove the photo.");
  };

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
        className="admin-modal-scroll max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-screen-title" className="text-base font-semibold text-foreground">
            {editing ? "Edit Room" : "Add Room"}
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
            <Label htmlFor="screen-name">Room Name</Label>
            <Input
              id="screen-name"
              autoFocus
              className="h-11"
              placeholder="Room 1"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              aria-invalid={Boolean(errors.name)}
              disabled={saving}
            />
            {fieldError("name")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screen-type">Room Type</Label>
            <Input
              id="screen-type"
              className="h-11"
              placeholder="Standard, VIP, Barkada…"
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
            {seatMode ? null : (
              <p className="text-xs text-muted-foreground">The room price covers this many people.</p>
            )}
            {fieldError("capacity")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screen-rental-price">{priceLabel} (₱)</Label>
            <Input
              id="screen-rental-price"
              type="number"
              min={0}
              step="0.01"
              className="h-11"
              placeholder="Required before customers can book"
              value={form.rental_price}
              onChange={(e) => setForm((prev) => ({ ...prev, rental_price: e.target.value }))}
              aria-invalid={Boolean(errors.rental_price)}
              disabled={saving}
            />
            {fieldError("rental_price")}
          </div>

          {/* By room only: by seat, every person already pays for a seat. */}
          {!seatMode && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="screen-extra-guest-fee">Additional Person (₱)</Label>
              <Input
                id="screen-extra-guest-fee"
                type="number"
                min={0}
                step="0.01"
                className="h-11"
                placeholder="Optional, e.g. 75.00"
                value={form.extra_guest_fee}
                onChange={(e) => setForm((prev) => ({ ...prev, extra_guest_fee: e.target.value }))}
                aria-invalid={Boolean(errors.extra_guest_fee)}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Each person past the capacity pays this. Leave blank to keep bookings within the capacity.
              </p>
              {fieldError("extra_guest_fee")}
            </div>
          )}

          {editing && (
            <div className="flex flex-col gap-1.5">
              <Label>Room Photos</Label>
              <div className="grid grid-cols-4 gap-2">
                {(editing.photos ?? []).map((url) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => void removePhoto(url)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {(editing.photos?.length ?? 0) < 10 && (
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={uploadingPhoto}
                    aria-label="Add room photo"
                    className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground hover:text-foreground"
                  >
                    {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadPhoto(file);
                }}
              />
            </div>
          )}

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
                "Save Room"
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
          <span>Loading rooms…</span>
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
          {activeCount} Active Room{activeCount === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <SquarePlus className="h-4 w-4" />
          Add Room
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">{priceLabel}</th>
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
                <td className="px-4 py-3 text-muted-foreground">{screen.capacity} people</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {screen.rental_price ? `₱${Number(screen.rental_price).toLocaleString()}` : "—"}
                  {!seatMode && screen.extra_guest_fee !== null && (
                    <span className="block text-xs">
                      Additional Person: ₱{Number(screen.extra_guest_fee).toLocaleString()}
                    </span>
                  )}
                </td>
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
                    title="Edit room"

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
