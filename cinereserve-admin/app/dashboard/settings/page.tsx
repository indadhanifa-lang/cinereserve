import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SETTINGS_CARDS } from "@/lib/dashboard-nav";

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
      {SETTINGS_CARDS.map((card) => (
        <div
          key={card.title}
          className="group flex flex-col justify-between rounded-xl border border-border/30 bg-card p-5 transition-all hover:bg-muted sm:p-6"
        >
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-primary transition-transform group-hover:scale-105">
              <card.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">{card.title}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{card.description}</p>
          </div>
          <Link
            href={card.href ?? "#"}
            className="inline-flex items-center gap-1 text-sm font-medium text-secondary-foreground hover:opacity-80"
          >
            <span>{card.cta}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}
