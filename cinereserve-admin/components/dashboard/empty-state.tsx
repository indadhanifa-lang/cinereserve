import type { Icon } from "@/lib/dashboard-nav";

type EmptyStateProps = {
  icon: Icon;
  title: string;
  description: string;
  cta?: { label: string; icon: Icon; href?: string; onClick?: () => void };
};

export function EmptyState({ icon: StateIcon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/30 bg-card p-6 text-center shadow-xl sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 shadow-inner">
          <StateIcon className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">{title}</h2>
        <p className="mx-auto mb-8 max-w-md text-sm text-muted-foreground">{description}</p>
        {cta &&
          (cta.onClick ? (
            <button
              type="button"
              onClick={cta.onClick}
              className="inline-flex transform items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
            >
              <cta.icon className="h-5 w-5" />
              <span>{cta.label}</span>
            </button>
          ) : (
            <a
              href={cta.href ?? "#"}
              className="inline-flex transform items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
            >
              <cta.icon className="h-5 w-5" />
              <span>{cta.label}</span>
            </a>
          ))}
      </div>
    </div>
  );
}
