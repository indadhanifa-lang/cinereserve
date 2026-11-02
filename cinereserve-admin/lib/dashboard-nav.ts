import type { ComponentType } from "react";
import {
  Armchair,
  BarChart3,
  CalendarDays,
  Clock,
  Film,
  ImagePlus,
  LayoutDashboard,
  LineChart,
  MonitorPlay,
  Palette,
  PlusCircle,
  QrCode,
  Receipt,
  Settings2,
  Shield,
  Sparkles,
  SquarePlus,
  Store,
  Ticket,
  Tv,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type ModuleId =
  | "dashboard"
  | "business"
  | "movies"
  | "screens"
  | "seats"
  | "schedules"
  | "reservations"
  | "customers"
  | "payments"
  | "tickets"
  | "reports"
  | "ai-analytics"
  | "settings";

export type Icon = ComponentType<{ className?: string }>;
export type NavItem = { id: ModuleId; label: string; icon: Icon; href: string };

export const HREF_BY_ID: Record<ModuleId, string> = {
  dashboard: "/dashboard",
  business: "/dashboard/business",
  movies: "/dashboard/movies",
  screens: "/dashboard/screens",
  seats: "/dashboard/seats",
  schedules: "/dashboard/schedules",
  reservations: "/dashboard/reservations",
  customers: "/dashboard/customers",
  payments: "/dashboard/payments",
  tickets: "/dashboard/tickets",
  reports: "/dashboard/reports",
  "ai-analytics": "/dashboard/ai-analytics",
  settings: "/dashboard/settings",
};

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard, href: HREF_BY_ID.dashboard },
      { id: "business", label: "Business Profile", icon: Store, href: HREF_BY_ID.business },
    ],
  },
  {
    label: "Cinema Management",
    items: [
      { id: "movies", label: "Movies", icon: Film, href: HREF_BY_ID.movies },
      { id: "screens", label: "Rooms", icon: MonitorPlay, href: HREF_BY_ID.screens },
      { id: "seats", label: "Seats", icon: Armchair, href: HREF_BY_ID.seats },
      { id: "schedules", label: "Schedules", icon: CalendarDays, href: HREF_BY_ID.schedules },
    ],
  },
  {
    label: "Bookings",
    items: [
      { id: "reservations", label: "Reservations", icon: Ticket, href: HREF_BY_ID.reservations },
      { id: "customers", label: "Customers", icon: Users, href: HREF_BY_ID.customers },
      { id: "payments", label: "Payments", icon: Wallet, href: HREF_BY_ID.payments },
      { id: "tickets", label: "Tickets", icon: Receipt, href: HREF_BY_ID.tickets },
    ],
  },
  {
    label: "Analytics",
    items: [
      { id: "reports", label: "Reports", icon: LineChart, href: HREF_BY_ID.reports },
      { id: "ai-analytics", label: "AI Analytics", icon: Sparkles, href: HREF_BY_ID["ai-analytics"] },
    ],
  },
];

/** `action` is a header button beside the title, shown on the module's list page only. */
export const META: Record<
  ModuleId,
  { title: string; subtitle: string; action?: { label: string; icon: Icon; href: string } }
> = {
  dashboard: {
    title: "Overview",
    subtitle: "Bookings, revenue and today's showings at your establishment.",
  },
  business: {
    title: "Business Profile",
    subtitle: "Your establishment's public profile, booking model and setup progress.",
  },
  movies: {
    title: "Movie Catalog",
    subtitle: "Manage active cinema titles, age classifications, and runtimes.",
    action: { label: "Add Movie", icon: ImagePlus, href: "/dashboard/movies/new" },
  },
  screens: {
    title: "Rooms",
    subtitle: "Your screening rooms: capacity, room prices and photos.",
  },
  seats: {
    title: "Seating Layouts",
    subtitle: "Lay out seats and benches for each room, with labels and prices.",
  },
  schedules: {
    title: "Showtimes & Scheduling",
    subtitle: "Showings per room, with the price customers pay.",
  },
  reservations: {
    title: "Ticket Reservations",
    subtitle: "Track pending, confirmed and expired customer bookings.",
  },
  customers: {
    title: "Customer Directory",
    subtitle: "Customers who have booked at your establishment.",
  },
  payments: {
    title: "Payment Transactions",
    subtitle: "Payments received for your bookings.",
  },
  tickets: {
    title: "Issued Tickets",
    subtitle: "Tickets issued for confirmed bookings.",
  },
  reports: {
    title: "Reports & Analytics",
    subtitle: "Revenue, bookings and top movies by booking date.",
  },
  "ai-analytics": {
    title: "AI Yield & Analytics",
    subtitle: "Busiest days and hours, next week's demand forecast, and AI recommendations.",
  },
  settings: {
    title: "Account Settings",
    subtitle: "Your profile, password and establishment contact details.",
  },
};

export type EmptyModuleId = Exclude<ModuleId, "dashboard" | "business" | "settings">;

export const EMPTY_STATES: Record<
  EmptyModuleId,
  {
    icon: Icon;
    title: string;
    description: string;
    cta?: { label: string; icon: Icon; href?: string };
  }
> = {
  movies: {
    icon: Film,
    title: "No Movies Yet",
    description: "Movies added to your cinema catalog will appear here.",
    cta: { label: "Add Movie", icon: ImagePlus, href: "/dashboard/movies/new" },
  },
  screens: {
    icon: MonitorPlay,
    title: "No Rooms Yet",
    description: "Create a room before configuring seats and schedules.",
    cta: { label: "Add Room", icon: SquarePlus },
  },
  seats: {
    icon: Armchair,
    title: "No Seat Layout Available",
    description: "Select or create a room before configuring its seat layout.",
  },
  schedules: {
    icon: Clock,
    title: "No Schedules Yet",
    description: "Movie showtimes and schedules will appear here.",
    cta: { label: "Create Schedule", icon: PlusCircle },
  },
  reservations: {
    icon: Receipt,
    title: "No Reservations Yet",
    description: "Customer reservations will appear here once bookings are made.",
  },
  customers: {
    icon: Users,
    title: "No Customer Activity Yet",
    description: "Customers with reservations at this cinema branch will appear here.",
  },
  payments: {
    icon: Wallet,
    title: "No Payments Yet",
    description: "Payment records associated with reservations will appear here.",
  },
  tickets: {
    icon: QrCode,
    title: "No Tickets Yet",
    description: "Confirmed customer tickets will appear here.",
  },
  reports: {
    icon: BarChart3,
    title: "No Report Data Yet",
    description:
      "Revenue, reservations, occupancy, and movie performance reports will appear once data is available.",
  },
  "ai-analytics": {
    icon: Sparkles,
    title: "Not Enough Bookings Yet",
    description:
      "Demand patterns, forecasts and AI recommendations appear here once shows with confirmed bookings have run.",
  },
};

export type SettingsModal = "branch" | "profile" | "security";

export const SETTINGS_CARDS: {
  icon: Icon;
  title: string;
  description: string;
  cta: string;
  modal?: SettingsModal;
}[] = [
  {
    icon: Store,
    title: "Branch Profile",
    description: "Establishment address and contact details. Hours, photos and booking model live in Business Profile.",
    cta: "Configure Branch",
    modal: "branch",
  },
  {
    icon: UserCog,
    title: "Admin Profile",
    description: "Staff roles, administrative permissions, internal authentication, and shift rosters.",
    cta: "Configure Profile",
    modal: "profile",
  },
  {
    icon: Palette,
    title: "Branding",
    description:
      "Custom branch ticketing templates, email design headers, logos, and UI color palettes.",
    cta: "Configure Branding",
  },
  {
    icon: Shield,
    title: "Security",
    description: "Change your admin password and sign out every other device in one step.",
    cta: "Change Password",
    modal: "security",
  },
];

export const DASHBOARD_STATS = [
  {
    icon: Wallet,
    label: "Today's Box Office",
    footLabel: "Payments today",
  },
  {
    icon: Tv,
    label: "Active Screenings",
    footLabel: "Rooms ready",
  },
  {
    icon: Armchair,
    label: "Hall Occupancy Rate",
    footLabel: "Capacity total",
  },
  {
    icon: Ticket,
    label: "Reservations Issued",
    footLabel: "Pending reservations",
  },
];

export const SETTINGS_ICON = Settings2;
