import { useEffect, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter } from "@ionic/react";
import {
  arrowBackOutline,
  chevronForward,
  filmOutline,
  gridOutline,
  locationOutline,
  peopleOutline,
} from "ionicons/icons";
import { apiGetAuth, resolveStorageUrl } from "../lib/api";
import { navigate } from "../lib/nav";
import "./Cinemas.css";

interface Cinema {
  id: number;
  name: string;
  description: string | null;
  category: string;
  booking_mode: "room" | "seat";
  city: string;
  province: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

/** Every active cinema, mini cinemas and regular ones alike. */
const Cinemas: React.FC = () => {
  const ionRouter = useIonRouter();
  const [cinemas, setCinemas] = useState<Cinema[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetAuth<{ branches: Cinema[] }>("/public/branches")
      .then((data) => setCinemas(data.branches))
      .catch(() => setError("Unable to load cinemas. Please try again."));
  }, []);

  return (
    <IonPage>
      <div className="cinemas-page">
        <header className="cinemas-header">
          <button type="button" className="cinemas-header__back" aria-label="Back" onClick={() => navigate(ionRouter, "/home")}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <h1 className="cinemas-header__title">Mini Cinemas</h1>
        </header>

        <IonContent scrollY className="cinemas-content">
          <div className="cinemas-body">
            {error ? (
              <p className="cinemas-empty">{error}</p>
            ) : cinemas === null ? (
              <div className="cinemas-empty">
                <IonSpinner name="dots" />
              </div>
            ) : cinemas.length === 0 ? (
              <p className="cinemas-empty">No cinemas are open for booking yet.</p>
            ) : (
              <>
                <section className="cinemas-intro">
                  <h2 className="cinemas-intro__title">Watch with your people</h2>
                  <p className="cinemas-intro__text">
                    Rent a whole room for your group or book just the seats you need, any movie, any time they're open.
                  </p>
                </section>

                <p className="cinemas-count">
                  {cinemas.length} {cinemas.length === 1 ? "cinema" : "cinemas"}
                </p>

                {cinemas.map((cinema) => {
                  // Logos are often square artwork, so they sit in a thumb
                  // (contained) instead of being cropped into a banner.
                  const logo = resolveStorageUrl(cinema.logo_url ?? cinema.cover_url);
                  return (
                    <button
                      type="button"
                      key={cinema.id}
                      className="cinema-card"
                      onClick={() => navigate(ionRouter, `/cinema?id=${cinema.id}`)}
                    >
                      <div className="cinema-card__image">
                        {logo ? <img src={logo} alt="" /> : <IonIcon icon={filmOutline} />}
                      </div>
                      <div className="cinema-card__info">
                        <h2 className="cinema-card__name">{cinema.name}</h2>
                        <p className="cinema-card__meta">
                          <IonIcon icon={locationOutline} aria-hidden="true" />
                          <span>{[cinema.city, cinema.province].filter(Boolean).join(", ")}</span>
                        </p>
                        {cinema.description && <p className="cinema-card__desc">{cinema.description}</p>}
                        <span className="cinema-card__badge">
                          <IonIcon icon={cinema.booking_mode === "room" ? peopleOutline : gridOutline} aria-hidden="true" />
                          {cinema.booking_mode === "room" ? "Whole room" : "Per seat"}
                        </span>
                      </div>
                      <IonIcon icon={chevronForward} className="cinema-card__chevron" aria-hidden="true" />
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </IonContent>
      </div>
    </IonPage>
  );
};

export default Cinemas;
