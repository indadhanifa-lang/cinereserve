"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil, SquarePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_STATES } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

type Schedule = {
  id: number;
  movie_id: number;
  screen_id: number;
  show_date: string;
  start_time: string;
  end_time: string;
  ticket_price: string | number;
  status: string;
  movie_title: string | null;
  screen_name: string | null;
};

type MovieOption = { id: number; title: string };
type ScreenOption = { id: number; name: string };

type FormErrors = Partial<
  Record<
    "movie_id" | "screen_id" | "show_date" | "start_time" | "end_time" | "ticket_price" | "status",
    string
  >
>;

const EMPTY_FORM = {
  movie_id: "",
  screen_id: "",
  show_date: "",
  start_time: "",
  end_time: "",
  ticket_price: "",
  status: "active",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-30" → "Sep 30, 2026" */
const formatDate = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};

/** "18:00:00" or "18:00" → "6:00 PM" */
const formatTime = (value: string): string => {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = minuteRaw ?? "00";
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${suffix}`;
};

/** 250 or "250.00" → "₱250.00" */
const formatPrice = (value: string | number): string => {
  const amount = Number(value);
  return Number.isNaN(amount) ? `₱${value}` : `₱${amount.toFixed(2)}`;
};

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [screens, setScreens] = useState<ScreenOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSchedules = (silent = false) => {
    fetch("/api/admin/schedules")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message ?? "Unable to load schedules. Try again.");
        }
        setSchedules(data.schedules ?? []);
      })
      .catch((err: Error) => {
        const message = err.message || "Unable to load schedules. Try again.";
        if (silent) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      });
  };

  useEffect(() => loadSchedules(), []);

  // Movie and screen choices load once; screens are already scoped to
  // the authenticated admin's branch by the backend.
  useEffect(() => {
    fetch("/api/admin/movies")
      .then((res) => res.json())
      .then((data) => setMovies(data.movies ?? []))
      .catch(() => toast.error("Unable to load movies. Try again."));
    fetch("/api/admin/screens")
      .then((res) => res.json())
      .then((data) => setScreens(data.screens ?? []))
      .catch(() => toast.error("Unable to load screens. Try again."));
  }, []);

  const openModal = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule);
    setForm({
      movie_id: String(schedule.movie_id),
      screen_id: String(schedule.screen_id),
      show_date: schedule.show_date,
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      ticket_price: String(Number(schedule.ticket_price)),
      status: schedule.status,
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

    const ticketPrice = Number(form.ticket_price);
    const clientErrors: FormErrors = {};
    if (!form.movie_id) clientErrors.movie_id = "Movie is required.";
    if (!form.screen_id) clientErrors.screen_id = "Screen is required.";
    if (!form.show_date) clientErrors.show_date = "Show date is required.";
    if (!form.start_time) clientErrors.start_time = "Start time is required.";
    if (!form.end_time) clientErrors.end_time = "End time is required.";
    else if (form.start_time && form.end_time <= form.start_time) {
      clientErrors.end_time = "End time must be after start time.";
    }
    if (!form.ticket_price.trim()) clientErrors.ticket_price = "Ticket price is required.";
    else if (Number.isNaN(ticketPrice) || ticketPrice < 0) {
      clientErrors.ticket_price = "Ticket price must be a number of 0 or more.";
    }
    if (editing && !form.status) clientErrors.status = "Status is required.";

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    setSaving(true);
    setErrors({});
    setFormError(null);

    const isEdit = editing !== null;
    const endpoint = isEdit
      ? `/api/admin/schedules/${editing.id}`
      : "/api/admin/schedules";

    try {
      // branch_id never sent: the backend derives it from the admin.
      // status only sent on edit; create defaults to "active" server-side.
      const payload: Record<string, unknown> = {
        movie_id: Number(form.movie_id),
        screen_id: Number(form.screen_id),
        show_date: form.show_date,
        start_time: form.start_time,
        end_time: form.end_time,
        ticket_price: ticketPrice,
      };
      if (isEdit) payload.status = form.status;

      const res = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of [
          "movie_id",
          "screen_id",
          "show_date",
          "start_time",
          "end_time",
          "ticket_price",
          "status",
        ] as const) {
          if (data.errors?.[key]?.[0]) fieldErrors[key] = data.errors[key][0];
        }
        const message =
          data.message ?? "Check the highlighted fields and try again.";
        setErrors(fieldErrors);
        setFormError(message);
        toast.error(message);
        return;
      }

      if (!res.ok) {
        const message =
          data.message ??
          (isEdit
            ? "Unable to update the schedule. Try again."
            : "Unable to create the schedule. Try again.");
        setFormError(message);
        toast.error(message);
        return;
      }

      setForm(EMPTY_FORM);
      setEditing(null);
      setModalOpen(false);

      if (isEdit) {
        loadSchedules(true);
        toast.success("Schedule updated.");
      } else {
        const created: Schedule = data.schedule;
        setSchedules((prev) => [...(prev ?? []), created]);
        toast.success(
          `Schedule for "${created.movie_title ?? "movie"}" created.`
        );
      }
    } catch {
      const message = "Unable to reach the server. Try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = (schedules ?? []).filter(
    (schedule) => schedule.status === "active"
  ).length;

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
        aria-labelledby="new-schedule-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="new-schedule-title" className="text-base font-semibold text-foreground">
            {editing ? "Edit Schedule" : "Create Schedule"}
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
            <Label htmlFor="schedule-movie">Movie</Label>
            <select
              id="schedule-movie"
              autoFocus
              value={form.movie_id}
              onChange={(e) => setForm((prev) => ({ ...prev, movie_id: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-invalid={Boolean(errors.movie_id)}
              disabled={saving}
            >
              <option value="">Select a movie</option>
              {movies.map((movie) => (
                <option key={movie.id} value={movie.id}>
                  {movie.title}
                </option>
              ))}
            </select>
            {fieldError("movie_id")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-screen">Screen</Label>
            <select
              id="schedule-screen"
              value={form.screen_id}
              onChange={(e) => setForm((prev) => ({ ...prev, screen_id: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-invalid={Boolean(errors.screen_id)}
              disabled={saving}
            >
              <option value="">Select a screen</option>
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>
            {fieldError("screen_id")}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-date">Show Date</Label>
            <Input
              id="schedule-date"
              type="date"
              className="h-11"
              value={form.show_date}
              onChange={(e) => setForm((prev) => ({ ...prev, show_date: e.target.value }))}
              aria-invalid={Boolean(errors.show_date)}
              disabled={saving}
            />
            {fieldError("show_date")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-start">Start Time</Label>
              <Input
                id="schedule-start"
                type="time"
                className="h-11"
                value={form.start_time}
                onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                aria-invalid={Boolean(errors.start_time)}
                disabled={saving}
              />
              {fieldError("start_time")}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-end">End Time</Label>
              <Input
                id="schedule-end"
                type="time"
                className="h-11"
                value={form.end_time}
                onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                aria-invalid={Boolean(errors.end_time)}
                disabled={saving}
              />
              {fieldError("end_time")}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-price">Ticket Price</Label>
            <Input
              id="schedule-price"
              type="number"
              min={0}
              step={0.01}
              className="h-11"
              placeholder="250.00"
              value={form.ticket_price}
              onChange={(e) => setForm((prev) => ({ ...prev, ticket_price: e.target.value }))}
              aria-invalid={Boolean(errors.ticket_price)}
              disabled={saving}
            />
            {fieldError("ticket_price")}
          </div>

          {editing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-status">Status</Label>
              <select
                id="schedule-status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-invalid={Boolean(errors.status)}
                disabled={saving}
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
              {fieldError("status")}
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
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create Schedule"
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

  if (schedules === null) {
    return (
      <>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading schedules…</span>
        </div>
        {modal}
      </>
    );
  }

  if (schedules.length === 0) {
    return (
      <>
        <EmptyState
          {...EMPTY_STATES.schedules}
          cta={{ ...EMPTY_STATES.schedules.cta!, onClick: openModal }}
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
          {activeCount} Active Schedule{activeCount === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <SquarePlus className="h-4 w-4" />
          Create Schedule
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/30 bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/30 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Movie</th>
              <th className="px-4 py-3 font-medium">Screen</th>
              <th className="px-4 py-3 font-medium">Show Date</th>
              <th className="px-4 py-3 font-medium">Start Time</th>
              <th className="px-4 py-3 font-medium">End Time</th>
              <th className="px-4 py-3 font-medium">Ticket Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {schedules.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 font-semibold text-foreground">
                  {schedule.movie_title ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {schedule.screen_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(schedule.show_date)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatTime(schedule.start_time)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatTime(schedule.end_time)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatPrice(schedule.ticket_price)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs capitalize",
                      schedule.status === "active"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {schedule.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(schedule)}
                    aria-label={`Edit schedule for ${schedule.movie_title ?? "movie"}`}
                    title="Edit schedule"
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
