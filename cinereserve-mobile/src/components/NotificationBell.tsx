import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon, IonSpinner, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { checkmarkDoneOutline, filmOutline, notificationsOffOutline, notificationsOutline } from "ionicons/icons";
import { apiGetAuth, apiPatchAuth, apiPostAuth, resolveStorageUrl } from "../lib/api";
import { navigate } from "../lib/nav";
import MovieDetailsSheet, { type MovieDetails } from "./MovieDetailsSheet";
import "../pages/Notifications.css";

interface CustomerNotification {
  id: number;
  title: string;
  message: string;
  poster_url: string | null;
  movie_id: number | null;
  /** Null for notifications that aren't about a movie. */
  branch: { id: number; name: string; category: string; booking_mode: string } | null;
  unread: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: CustomerNotification[];
  unread_count: number;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "5 minutes ago", "yesterday", "3 days ago". */
const timeAgo = (iso: string): string => {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes > -60) return relative.format(Math.min(minutes, -1), "minute");
  if (minutes > -1440) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / 1440), "day");
};

/** Header bell: unread badge, and a dropdown listing new movies from every branch. */
const NotificationBell: React.FC = () => {
  const ionRouter = useIonRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<CustomerNotification[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<MovieDetails | null>(null);

  const load = () => {
    setError(false);
    apiGetAuth<NotificationsResponse>("/customer/notifications")
      .then((data) => {
        setItems(data.notifications);
        setUnread(data.unread_count);
      })
      .catch(() => setError(true));
  };

  // Pages stay mounted in Ionic, so recount each time the page comes back.
  useIonViewWillEnter(() => {
    setOpen(false);
    setDetails(null);
    load();
  });

  // A tap outside the dropdown or Escape closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) load();
    setOpen(!open);
  };

  // Clears the dots right away and puts them back if the server didn't save it.
  const markAllRead = () => {
    const before = { items, unread };
    setItems((current) => current?.map((item) => ({ ...item, unread: false })) ?? null);
    setUnread(0);
    apiPostAuth("/customer/notifications/seen", {}).catch(() => {
      setItems(before.items);
      setUnread(before.unread);
    });
  };

  // Empties the list the same way, restoring it if the server didn't save it.
  const clearAll = () => {
    const before = { items, unread };
    setItems([]);
    setUnread(0);
    apiPostAuth("/customer/notifications/clear", {}).catch(() => {
      setItems(before.items);
      setUnread(before.unread);
    });
  };

  // Marks the tapped one read, then opens the movie's details from the same
  // feed the Movies tab uses. A movie no longer in it (no upcoming showtimes)
  // falls back to booking the mini cinema or the Movies tab.
  const openItem = (item: CustomerNotification) => {
    setOpen(false);
    if (item.unread) {
      setItems((current) => current?.map((other) => (other.id === item.id ? { ...other, unread: false } : other)) ?? null);
      setUnread((count) => Math.max(0, count - 1));
      apiPatchAuth<{ unread_count: number }>(`/customer/notifications/${item.id}/read`, {})
        .then((data) => setUnread(data.unread_count))
        .catch(() => undefined);
    }
    const branch = item.branch;
    if (!branch) return;
    const fallback = () =>
      navigate(
        ionRouter,
        branch.category === "mini_cinema" ? `/booking/room?branch=${branch.id}&movie=${item.movie_id}` : "/movies"
      );
    apiGetAuth<{ movies?: MovieDetails[]; cinema_movies?: MovieDetails[] }>("/customer/showtimes")
      .then((feed) => {
        const movie = [...(feed.movies ?? []), ...(feed.cinema_movies ?? [])].find((m) => m.id === item.movie_id);
        if (movie) setDetails(movie);
        else fallback();
      })
      .catch(fallback);
  };

  return (
    <div className="notification-menu" ref={menuRef}>
      <button
        type="button"
        className="icon-button notification-bell"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
      >
        <IonIcon icon={notificationsOutline} />
        {unread > 0 && <span className="notification-bell__badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notification-dropdown" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown__header">
            <strong>Notifications</strong>
            <div className="notification-dropdown__actions">
              {unread > 0 ? (
                <button type="button" className="notifications-read-all" onClick={markAllRead}>
                  <IonIcon icon={checkmarkDoneOutline} aria-hidden="true" />
                  Mark all as read
                </button>
              ) : (
                <span>All caught up</span>
              )}
              {(items?.length ?? 0) > 0 && (
                <button type="button" className="notifications-read-all notifications-clear" onClick={clearAll}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="notification-dropdown__list">
            {error ? (
              <p className="notifications-empty">Unable to load notifications.</p>
            ) : !items ? (
              <div className="notifications-empty">
                <IonSpinner name="dots" />
              </div>
            ) : items.length === 0 ? (
              <div className="notifications-empty">
                <IonIcon icon={notificationsOffOutline} aria-hidden="true" />
                <strong>No notifications yet</strong>
                <p>We'll let you know when a cinema adds a new movie.</p>
              </div>
            ) : (
              items.map((item) => {
                const poster = resolveStorageUrl(item.poster_url);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`notification-item${item.unread ? " notification-item--unread" : ""}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="notification-item__poster">
                      {poster ? <img src={poster} alt="" /> : <IonIcon icon={filmOutline} />}
                    </span>
                    <span className="notification-item__body">
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{timeAgo(item.created_at)}</small>
                    </span>
                    {item.unread && <span className="notification-item__dot" aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Portaled: the page header's backdrop-filter would trap a fixed sheet inside it. */}
      {details && createPortal(<MovieDetailsSheet movie={details} onClose={() => setDetails(null)} />, document.body)}
    </div>
  );
};

export default NotificationBell;
