"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Armchair, Loader2, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

type Screen = {
  id: number;
  name: string;
  capacity: number;
};

type Seat = {
  id: number;
  row_label: string;
  seat_number: number;
  seat_type: string;
  price_modifier: number | string;
  status: string;
};

type FormErrors = Partial<Record<"rows" | "seatsPerRow" | "seatType" | "priceModifier", string>>;

const MAX_ROWS = 26;
const MAX_SEATS_PER_ROW = 50;

const EMPTY_FORM = { rows: "5", seatsPerRow: "8", seatType: "regular", priceModifier: "0" };

const seatClasses = (seat: Pick<Seat, "seat_type" | "status">) => {
  if (seat.status !== "active") {
    return "border-border/30 bg-muted/40 text-muted-foreground opacity-60";
  }
  if (seat.seat_type === "vip") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  }
  return "border-primary/40 bg-primary/10 text-foreground";
};

const rowLabel = (index: number) => String.fromCharCode(65 + index);

export default function SeatsPage() {
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [screensError, setScreensError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editSeat, setEditSeat] = useState<Seat | null>(null);
  const [editForm, setEditForm] = useState({ seatType: "regular", priceModifier: "0", status: "active" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/screens")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message ?? "Unable to load screens. Try again.");
        }
        setScreens(data.screens ?? []);
      })
      .catch((err: Error) => setScreensError(err.message || "Unable to load screens. Try again."));
  }, []);

  const requestRef = useRef(0);

  const loadSeats = (screenId: string, silent = false) => {
    const requestId = ++requestRef.current;
    setSeats(null);
    setSeatsError(null);
    fetch(`/api/admin/screens/${screenId}/seats`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message ?? "Unable to load seats. Try again.");
        }
        if (requestId === requestRef.current) {
          setSeats(data.seats ?? []);
        }
      })
      .catch((err: Error) => {
        if (requestId !== requestRef.current) return;
        const message = err.message || "Unable to load seats. Try again.";
        if (silent) {
          toast.error(message);
        } else {
          setSeatsError(message);
        }
      });
  };

  useEffect(() => {
    if (selectedId) {
      loadSeats(selectedId);
    } else {
      setSeats(null);
      setSeatsError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedScreen = (screens ?? []).find((screen) => String(screen.id) === selectedId) ?? null;

  const rowsCount = Number(form.rows);
  const seatsPerRowCount = Number(form.seatsPerRow);
  const hasPreviewNumbers =
    Number.isInteger(rowsCount) &&
    rowsCount >= 1 &&
    rowsCount <= MAX_ROWS &&
    Number.isInteger(seatsPerRowCount) &&
    seatsPerRowCount >= 1 &&
    seatsPerRowCount <= MAX_SEATS_PER_ROW;
  const previewTotal = hasPreviewNumbers ? rowsCount * seatsPerRowCount : 0;
  const exceedsCapacity =
    selectedScreen !== null && hasPreviewNumbers && previewTotal > selectedScreen.capacity;

  const openModal = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen && !editSeat) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setEditSeat(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, editSeat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !selectedId || !selectedScreen) return;

    const clientErrors: FormErrors = {};
    if (!form.rows.trim()) clientErrors.rows = "Number of rows is required.";
    else if (!Number.isInteger(rowsCount) || rowsCount < 1 || rowsCount > MAX_ROWS) {
      clientErrors.rows = `Rows must be a whole number between 1 and ${MAX_ROWS}.`;
    }
    if (!form.seatsPerRow.trim()) clientErrors.seatsPerRow = "Seats per row is required.";
    else if (!Number.isInteger(seatsPerRowCount) || seatsPerRowCount < 1 || seatsPerRowCount > MAX_SEATS_PER_ROW) {
      clientErrors.seatsPerRow = `Seats per row must be a whole number between 1 and ${MAX_SEATS_PER_ROW}.`;
    }

    const priceModifier = Number(form.priceModifier);
    if (!form.priceModifier.trim()) clientErrors.priceModifier = "Price modifier is required.";
    else if (!Number.isFinite(priceModifier) || priceModifier < 0) {
      clientErrors.priceModifier = "Price modifier must be a number of 0 or more.";
    }

    if (Object.keys(clientErrors).length > 0 || exceedsCapacity) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    const generated = [];
    for (let row = 0; row < rowsCount; row++) {
      for (let number = 1; number <= seatsPerRowCount; number++) {
        generated.push({
          row_label: rowLabel(row),
          seat_number: number,
          seat_type: form.seatType,
          price_modifier: priceModifier,
        });
      }
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    try {
      const res = await fetch(`/api/admin/screens/${selectedId}/seats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats: generated }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        setFormError(data.message ?? "Check the highlighted fields and try again.");
        return;
      }

      if (!res.ok) {
        setFormError(data.message ?? "Unable to save the seat layout. Try again.");
        return;
      }

      setModalOpen(false);
      toast.success("Seat layout saved.");
      loadSeats(selectedId, true);
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const openEditSeat = (seat: Seat) => {
    setEditSeat(seat);
    setEditForm({
      seatType: seat.seat_type === "vip" ? "vip" : "regular",
      priceModifier: String(Number(seat.price_modifier)),
      status: seat.status === "disabled" ? "disabled" : "active",
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editSaving || !editSeat) return;

    const priceModifier = Number(editForm.priceModifier);
    if (!editForm.priceModifier.trim() || !Number.isFinite(priceModifier)) {
      setEditError("Price modifier must be a number.");
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/seats/${editSeat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seat_type: editForm.seatType,
          price_modifier: priceModifier,
          status: editForm.status,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const fieldMessage =
          data.errors?.seat_type?.[0] ??
          data.errors?.price_modifier?.[0] ??
          data.errors?.status?.[0];
        setEditError(fieldMessage ?? data.message ?? "Unable to update the seat. Try again.");
        return;
      }

      const label = `${editSeat.row_label}${editSeat.seat_number}`;
      setEditSeat(null);
      toast.success(`Seat "${label}" updated.`);
      if (selectedId) {
        loadSeats(selectedId, true);
      }
    } catch {
      setEditError("Unable to reach the server. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? (
      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertCircle className="h-3.5 w-3.5" />
        {errors[key]}
      </p>
    ) : null;

  const modal = modalOpen && selectedScreen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !saving && setModalOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="configure-seats-title"
        onClick={(e) => e.stopPropagation()}
        className="admin-modal-scroll max-h-[90vh] w-full max-w-lg rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="configure-seats-title" className="text-base font-semibold text-foreground">
            Configure Seat Layout
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

        <p className="mb-4 text-xs text-muted-foreground">
          {selectedScreen.name} · Capacity {selectedScreen.capacity} seats
        </p>

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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seat-rows">Number of Rows</Label>
              <Input
                id="seat-rows"
                autoFocus
                type="number"
                min={1}
                max={MAX_ROWS}
                step={1}
                className="h-11"
                placeholder="5"
                value={form.rows}
                onChange={(e) => setForm((prev) => ({ ...prev, rows: e.target.value }))}
                aria-invalid={Boolean(errors.rows)}
                disabled={saving}
              />
              {fieldError("rows")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seat-per-row">Seats Per Row</Label>
              <Input
                id="seat-per-row"
                type="number"
                min={1}
                max={MAX_SEATS_PER_ROW}
                step={1}
                className="h-11"
                placeholder="8"
                value={form.seatsPerRow}
                onChange={(e) => setForm((prev) => ({ ...prev, seatsPerRow: e.target.value }))}
                aria-invalid={Boolean(errors.seatsPerRow)}
                disabled={saving}
              />
              {fieldError("seatsPerRow")}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seat-type">Default Seat Type</Label>
              <select
                id="seat-type"
                value={form.seatType}
                onChange={(e) => setForm((prev) => ({ ...prev, seatType: e.target.value }))}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={saving}
              >
                <option value="regular">Regular</option>
                <option value="vip">VIP</option>
              </select>
              {fieldError("seatType")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seat-price-modifier">Default Price Modifier</Label>
              <Input
                id="seat-price-modifier"
                type="number"
                min={0}
                step={0.01}
                className="h-11"
                placeholder="0"
                value={form.priceModifier}
                onChange={(e) => setForm((prev) => ({ ...prev, priceModifier: e.target.value }))}
                aria-invalid={Boolean(errors.priceModifier)}
                disabled={saving}
              />
              {fieldError("priceModifier")}
            </div>
          </div>

          {hasPreviewNumbers && (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
              <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Preview
              </div>
              <div className="admin-modal-scroll flex max-h-48 flex-col items-center gap-2">
                {Array.from({ length: rowsCount }, (_, row) => (
                  <div key={row} className="flex items-center gap-2">
                    <span className="w-4 text-right text-[10px] font-semibold text-muted-foreground">
                      {rowLabel(row)}
                    </span>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {Array.from({ length: seatsPerRowCount }, (_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md border text-[9px] font-semibold",
                            seatClasses({ seat_type: form.seatType, status: "active" })
                          )}
                        >
                          {rowLabel(row)}
                          {index + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={cn(
                  "mt-3 border-t border-border/20 pt-2.5 text-center text-xs",
                  exceedsCapacity ? "text-destructive" : "text-muted-foreground"
                )}
                role={exceedsCapacity ? "alert" : undefined}
              >
                {exceedsCapacity
                  ? `Layout has ${previewTotal} seats but ${selectedScreen.name} capacity is ${selectedScreen.capacity}. Reduce rows or seats per row.`
                  : `${previewTotal} of ${selectedScreen.capacity} seats`}
              </div>
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
            <Button
              type="submit"
              disabled={saving || exceedsCapacity || !hasPreviewNumbers}
              className="h-10 gap-2 rounded-full px-4"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Layout"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  const editModal = editSeat ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !editSaving && setEditSeat(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-seat-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-seat-title" className="text-base font-semibold text-foreground">
            Edit Seat
          </h2>
          <button
            type="button"
            onClick={() => setEditSeat(null)}
            aria-label="Close"
            disabled={editSaving}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {editError && (
          <p
            className="mb-4 flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {editError}
          </p>
        )}

        <form onSubmit={handleEditSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Seat</Label>
            <div className="flex h-11 items-center rounded-md border border-border/30 bg-muted/40 px-2.5 text-sm font-semibold text-foreground">
              {editSeat.row_label}
              {editSeat.seat_number}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-seat-type">Seat Type</Label>
            <select
              id="edit-seat-type"
              value={editForm.seatType}
              onChange={(e) => setEditForm((prev) => ({ ...prev, seatType: e.target.value }))}
              disabled={editSaving}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="regular">Regular</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-seat-price">Price Modifier</Label>
            <Input
              id="edit-seat-price"
              type="number"
              min={0}
              step={0.01}
              className="h-11"
              value={editForm.priceModifier}
              onChange={(e) => setEditForm((prev) => ({ ...prev, priceModifier: e.target.value }))}
              disabled={editSaving}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-seat-status">Status</Label>
            <select
              id="edit-seat-status"
              value={editForm.status}
              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
              disabled={editSaving}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditSeat(null)}
              disabled={editSaving}
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Cancel
            </button>
            <Button type="submit" disabled={editSaving} className="h-10 gap-2 rounded-full px-4">
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  if (screensError) {
    return <p className="text-sm text-destructive">{screensError}</p>;
  }

  if (screens === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading screens…</span>
      </div>
    );
  }

  if (screens.length === 0) {
    return <EmptyState {...EMPTY_STATES.seats} />;
  }

  const groupedRows = new Map<string, Seat[]>();
  for (const seat of seats ?? []) {
    const existing = groupedRows.get(seat.row_label);
    if (existing) {
      existing.push(seat);
    } else {
      groupedRows.set(seat.row_label, [seat]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {modal}
      {editModal}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="screen-select" className="text-sm text-muted-foreground">
            Screen
          </Label>
          <select
            id="screen-select"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setSeats(null);
              setSeatsError(null);
            }}
            className="h-10 min-w-48 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" disabled>
              Select Screen
            </option>
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>
                {screen.name}
              </option>
            ))}
          </select>
        </div>

        {selectedScreen && seats && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {seats.length} of {selectedScreen.capacity} seats
          </span>
        )}
      </div>

      {!selectedId && (
        <p className="text-sm text-muted-foreground">Select a screen to view its seat layout.</p>
      )}

      {selectedId && seats === null && !seatsError && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading seats…</span>
        </div>
      )}

      {selectedId && seatsError && (
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            {seatsError}
          </p>
          <button
            type="button"
            onClick={() => loadSeats(selectedId)}
            className="inline-flex h-9 items-center rounded-full border border-border/30 bg-muted px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retry
          </button>
        </div>
      )}

      {selectedId && seats !== null && seats.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-border/30 bg-card p-8 text-center shadow-xl">
          <p className="text-sm text-muted-foreground">No seats configured for this screen.</p>
          <button
            type="button"
            onClick={openModal}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Configure Seat Layout
          </button>
        </div>
      )}

      {selectedId && seats !== null && seats.length > 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-border/30 bg-card p-6 shadow-xl">
          <div className="mb-5 flex w-full flex-col items-center">
            <div className="h-8 w-2/3 rounded-t-full border-t-2 border-primary/40 bg-gradient-to-b from-primary/15 to-transparent" />
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              Screen
            </span>
          </div>

          <div className="flex w-full flex-col items-center gap-3 overflow-x-auto">
            {Array.from(groupedRows.entries()).map(([label, rowSeats]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                  {label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {rowSeats.map((seat) => (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => openEditSeat(seat)}
                      aria-label={`Edit seat ${seat.row_label}${seat.seat_number}`}
                      title={`${seat.row_label}${seat.seat_number} · ${seat.seat_type} · +${Number(seat.price_modifier)}`}
                      className={cn(
                        "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border text-[11px] font-semibold transition-opacity hover:opacity-75",
                        seatClasses(seat)
                      )}
                    >
                      {seat.row_label}
                      {seat.seat_number}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-border/20 pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-primary/40 bg-primary/10" />
              Regular
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-amber-400/40 bg-amber-400/10" />
              VIP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-border/30 bg-muted/40" />
              Disabled
            </span>
            <span className="flex items-center gap-1.5">
              <Armchair className="h-3.5 w-3.5 text-primary" />
              {seats.length} seats configured
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
