import type { ComponentType } from "react";
import {
  Armchair,
  BarChart3,
  CalendarDays,
  Clock,
  Film,
  ImagePlus,
  LayoutDashboard,
  LayoutGrid,
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
  TriangleAlert,
  Tv,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type ModuleId =
  | "dashboard"
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
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: HREF_BY_ID.dashboard }],
  },
  {
    label: "Cinema Management",
    items: [
      { id: "movies", label: "Movies", icon: Film, href: HREF_BY_ID.movies },
      { id: "screens", label: "Screens", icon: MonitorPlay, href: HREF_BY_ID.screens },
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

export const META: Record<ModuleId, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Overview of your cinema branch operations and reservations.",
  },
  movies: {
    title: "Movie Catalog",
    subtitle: "Manage active cinema titles, age classifications, and runtimes.",
  },
  screens: {
    title: "Auditoriums & Screens",
    subtitle: "Configure audio formats, screen capacities, and projection systems.",
  },
  seats: {
    title: "Seating Layouts",
    subtitle: "Architect seat tiers, VIP loungers, and wheelchair companion spots.",
  },
  schedules: {
    title: "Showtimes & Scheduling",
    subtitle: "Calendar timetable for screenings, intermissions, and cleaning slots.",
  },
  reservations: {
    title: "Ticket Reservations",
    subtitle: "Track active, completed, and pending audience bookings.",
  },
  customers: {
    title: "Customer Directory",
    subtitle: "Patron loyalty memberships, contact histories, and engagement data.",
  },
  payments: {
    title: "Payment Transactions",
    subtitle: "Real-time gateway settlements, refunds, and terminal transactions.",
  },
  tickets: {
    title: "Issued Tickets",
    subtitle: "Barcodes, QR validation registers, and gate admissions.",
  },
  reports: {
    title: "Reports & Audits",
    subtitle: "Branch box-office performance, concessions, and seat fill ratios.",
  },
  "ai-analytics": {
    title: "AI Yield & Analytics",
    subtitle: "Dynamic demand models, automatic scheduling, and concession forecasting.",
  },
  settings: {
    title: "Branch Settings",
    subtitle: "System preferences, identity parameters, and security policies.",
  },
};

export type EmptyModuleId = Exclude<ModuleId, "dashboard" | "settings">;

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
    title: "No Screens Yet",
    description: "Create cinema screens before configuring seats and schedules.",
    cta: { label: "Add Screen", icon: SquarePlus },
  },
  seats: {
    icon: Armchair,
    title: "No Seat Layout Available",
    description: "Select or create a cinema screen before configuring its seat layout.",
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
    title: "AI Analytics Not Available Yet",
    description:
      "Demand predictions and AI insights will appear here after the core reservation system is completed.",
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
    description:
      "Cinema address, contact points, operational hours, and auditorium physical constraints.",
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
    value: "…",
    hint: "Loading…",
    footLabel: "Payments today",
    footValue: "…",
  },
  {
    icon: Tv,
    label: "Active Screenings",
    value: "0",
    hint: "Screens standby",
    footLabel: "Auditoriums ready",
    footValue: "4 Halls",
  },
  {
    icon: Armchair,
    label: "Hall Occupancy Rate",
    value: "0%",
    hint: "No active seats",
    footLabel: "Capacity total",
    footValue: "520 Seats",
  },
  {
    icon: Ticket,
    label: "Reservations Issued",
    value: "…",
    hint: "Confirmed today",
    footLabel: "Pending reservations",
    footValue: "…",
  },
];

export const DASHBOARD_SUBVIEWS = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Alerts & Logs", icon: TriangleAlert },
];

export const SETTINGS_ICON = Settings2;
