import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  ArrowRight,
  CalendarClock,
  ChartColumn,
  Clapperboard,
  CreditCard,
  DoorClosed,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Ticket,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "CineReserve AI — Book mini cinemas, or partner with us",
  description:
    "Book a private room or your seats at mini cinemas near you, or register your mini cinema business on CineReserve AI.",
};

// Where "Book a Cinema" sends customers: the CineReserve customer app.
const CUSTOMER_APP_URL = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL ?? "http://localhost:5173";

// Shown in the Contact section and footer. Replace with the real support details.
const CONTACT = {
  email: "partners@cinereserve.ai",
  phone: "+63 900 000 0000",
  address: "Cagayan de Oro City, Philippines",
};

type Partner = {
  id: number;
  name: string;
  description: string | null;
  booking_mode: "room" | "seat";
  city: string;
  province: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

/** Live establishments for the landing page; an unreachable API just hides the section. */
async function featuredPartners(): Promise<Partner[]> {
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/branches`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.branches ?? []).slice(0, 6);
  } catch {
    return [];
  }
}

const FAQS = [
  {
    q: "How much does it cost to partner with CineReserve?",
    a: "Registering your mini cinema and setting up your rooms, seats and movies is free.",
  },
  {
    q: "Do I have to wait for approval?",
    a: "No. Once your business profile, priced rooms (or seating layout) and at least one movie are set up, your establishment goes live in the app automatically.",
  },
  {
    q: "Can I sell whole rooms instead of seats?",
    a: "Yes. When you register an establishment you choose By Room (groups rent the whole room for a showing) or By Seat (customers pick seats or benches).",
  },
  {
    q: "Can I manage more than one branch?",
    a: "Yes. One owner account can register several establishments and switch between them from the partner dashboard.",
  },
  {
    q: "How do customers pay?",
    a: "Customers pay in the CineReserve app when they book, and every paid booking gets a ticket your staff can check at the door.",
  },
];

const BOOKING_MODES = [
  {
    icon: DoorClosed,
    title: "Book a private room",
    body: "Couples, families and barkadas rent a whole room for their movie. No strangers, just their group.",
  },
  {
    icon: Armchair,
    title: "Book by seat",
    body: "Solo viewers and small groups pick their own seats in a shared screening.",
  },
];

const FEATURES = [
  {
    icon: Clapperboard,
    title: "Your movie lineup",
    body: "Post what's showing and what's coming soon, with posters and genres.",
  },
  {
    icon: Armchair,
    title: "Your rooms and seats",
    body: "Set up each viewing room, from a small private room to your biggest screen.",
  },
  {
    icon: CalendarClock,
    title: "Bookings without clashes",
    body: "Customers pick any movie and an open time; a room is never double-booked.",
  },
  {
    icon: CreditCard,
    title: "Bookings & payments in the app",
    body: "Customers book a room or their seats and pay ahead. No more reservations over chat.",
  },
  {
    icon: Ticket,
    title: "Tickets at the door",
    body: "Every paid booking gets a ticket your staff can check when guests arrive.",
  },
  {
    icon: ChartColumn,
    title: "Know your sales",
    body: "See today's screenings, bookings, payments and how full each show is.",
  },
];

const STEPS = [
  {
    title: "Create your owner account",
    body: "Sign up with your name, email and contact number, then register your establishment.",
  },
  {
    title: "Set up rooms or seats",
    body: "Choose By Room or By Seat, add your priced rooms or seating layout and your movie catalog.",
  },
  {
    title: "Go live automatically",
    body: "As soon as setup is complete your mini cinema appears in the CineReserve app. No approval wait.",
  },
];

const primaryCta = cn(
  buttonVariants(),
  "h-12 gap-2 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-primary/30"
);
const secondaryCta = cn(
  buttonVariants({ variant: "outline" }),
  "h-12 rounded-xl px-6 text-sm font-semibold"
);

export default async function LandingPage() {
  const partners = await featuredPartners();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/20 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="CineReserve AI" className="h-10 w-auto" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
            <a href="#contact" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
              Partner with us
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src="/background.png" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          </div>

          <div className="relative mx-auto flex max-w-6xl flex-col items-start px-4 py-24 sm:px-6 sm:py-32">
            <span className="mb-5 rounded-full bg-secondary/40 px-3 py-1 text-xs font-semibold tracking-wider text-secondary-foreground uppercase">
              For mini cinemas &amp; movie cafés
            </span>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Take your mini cinema{" "}
              <span className="bg-gradient-to-r from-[#7c3aed] via-[#a78bfa] to-[#d2bbff] bg-clip-text text-transparent">
                online.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Book a private room or your seats at mini cinemas near you. Or run
              your own: list your rooms and movies, take bookings and payments
              in the CineReserve app, and manage everything from one dashboard.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={CUSTOMER_APP_URL} className={primaryCta}>
                <Ticket className="h-4 w-4" />
                Book a cinema
              </a>
              <Link href="/register" className={secondaryCta}>
                Partner with us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Booking modes */}
        <section className="border-t border-border/20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Two ways to sell your screenings</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Each establishment picks the model that fits its space: whole private rooms, or
              individual seats and benches.
            </p>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {BOOKING_MODES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-5 rounded-2xl border border-border/30 bg-card p-8">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-1.5 leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t border-border/20 bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Everything your mini cinema needs</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Whether you run one private room or several, every booking lives in one place.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border/30 bg-card p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Live in three steps</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ title, body }, i) => (
                <li key={title} className="flex flex-col">
                  <span className="text-5xl font-bold text-primary/40">0{i + 1}</span>
                  <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Featured partners */}
        {partners.length > 0 && (
          <section id="partners" className="scroll-mt-16 border-t border-border/20 bg-card/40">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <h2 className="text-3xl font-bold tracking-tight">Featured mini cinemas</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">Open now and taking bookings in the app.</p>
              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {partners.map((partner) => (
                  <a
                    key={partner.id}
                    href={CUSTOMER_APP_URL}
                    className="overflow-hidden rounded-2xl border border-border/30 bg-card transition-colors hover:border-primary/40"
                  >
                    <div className="aspect-video bg-muted">
                      {(partner.cover_url ?? partner.logo_url) && (
                        <img src={partner.cover_url ?? partner.logo_url ?? ""} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold">{partner.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[partner.city, partner.province].filter(Boolean).join(", ")} ·{" "}
                        {partner.booking_mode === "room" ? "Private rooms" : "By seat"}
                      </p>
                      {partner.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{partner.description}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 border-t border-border/20">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-10 flex flex-col gap-3">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-border/30 bg-card p-5">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {q}
                      <span className="text-primary transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="scroll-mt-16 border-t border-border/20 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-20 sm:grid-cols-3 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight sm:col-span-3">Contact us</h2>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card p-5">
              <Mail className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{CONTACT.email}</span>
            </a>
            <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card p-5">
              <Phone className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{CONTACT.phone}</span>
            </a>
            <div className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card p-5">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm">{CONTACT.address}</span>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-3xl border border-border/30 bg-card p-8 sm:p-12 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:flex">
                <Smartphone className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Ready to take your mini cinema online?</h2>
                <p className="mt-2 max-w-lg text-muted-foreground">
                  Register your business and start taking bookings in the CineReserve app today.
                </p>
              </div>
            </div>
            <Link href="/register" className={primaryCta}>
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} CineReserve AI</span>
          <nav className="flex flex-wrap items-center gap-5">
            <a href={CUSTOMER_APP_URL} className="transition-colors hover:text-foreground">
              Book a cinema
            </a>
            <Link href="/register" className="transition-colors hover:text-foreground">
              Partner with us
            </Link>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
            <a href={`mailto:${CONTACT.email}`} className="transition-colors hover:text-foreground">
              {CONTACT.email}
            </a>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Owner sign in
            </Link>
          </nav>

        </div>
      </footer>
    </div>
  );
}
