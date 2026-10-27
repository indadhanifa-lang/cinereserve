"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_CARDS, type SettingsModal } from "@/lib/dashboard-nav";
import { BranchProfileForm } from "@/components/settings/branch-profile-form";
import { AdminProfileForm } from "@/components/settings/admin-profile-form";
import { SecurityForm } from "@/components/settings/security-form";

const MODALS: Record<SettingsModal, { title: string; width: string; Body: React.ComponentType<{ onSaved?: () => void }> }> = {
  branch: { title: "Branch Profile", width: "max-w-2xl", Body: BranchProfileForm },
  profile: { title: "Admin Profile", width: "max-w-lg", Body: AdminProfileForm },
  security: { title: "Change Password", width: "max-w-lg", Body: SecurityForm },
};

export default function SettingsPage() {
  const [open, setOpen] = useState<SettingsModal | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const modal = open ? MODALS[open] : null;

  return (
    <>
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
            {card.modal ? (
              <button
                type="button"
                onClick={() => setOpen(card.modal!)}
                className="inline-flex items-center gap-1 self-start text-sm font-medium text-secondary-foreground hover:opacity-80"
              >
                <span>{card.cta}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="self-start rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "admin-modal-scroll max-h-[85vh] w-full rounded-2xl border border-primary/30 bg-card p-6 shadow-xl",
              modal.width
            )}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 id="settings-modal-title" className="text-xl font-bold text-foreground">
                {modal.title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <modal.Body onSaved={() => setOpen(null)} />
          </div>
        </div>
      )}
    </>
  );
}
