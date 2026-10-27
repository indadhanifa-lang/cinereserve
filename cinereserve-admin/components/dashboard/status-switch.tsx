"use client";

import { cn } from "@/lib/utils";

/** Active/inactive pill switch. Click does not bubble, so it is safe
 * inside clickable rows and cards. */
export function StatusSwitch({
  status,
  label,
  disabled,
  onToggle,
}: {
  status: string;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const active = status === "active";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="inline-flex items-center gap-2 rounded-full disabled:opacity-60"
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
          active ? "bg-emerald-500" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            active && "translate-x-4"
          )}
        />
      </span>
      {/* Fixed width: "Active" vs "Inactive" would otherwise resize table columns. */}
      <span
        className={cn(
          "inline-block w-14 text-left text-xs capitalize",
          active ? "text-emerald-400" : "text-muted-foreground"
        )}
      >
        {status}
      </span>
    </button>
  );
}
