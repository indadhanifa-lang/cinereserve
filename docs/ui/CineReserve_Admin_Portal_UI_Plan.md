# CineReserve AI — Admin Portal UI Plan

## 1. Purpose

The admin portal is the branch-level management interface for CineReserve AI.

**Target stack**
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Laravel REST API as the only application-data gateway

**Core rule**
- One shared admin codebase.
- Each admin account belongs to one branch.
- The UI may use the assigned branch's logo, name, primary color, and secondary color.
- Branch filtering and authorization must still be enforced by Laravel, not only by the frontend.

---

## 2. Primary Admin Goals

The portal should allow an authorized branch admin to:

1. View branch performance at a glance.
2. Manage movies available to the branch.
3. Manage cinema screens.
4. Create and maintain seat layouts.
5. Create and manage movie schedules.
6. View and manage reservations.
7. View customer information relevant to the branch.
8. Monitor payment records.
9. View and verify tickets.
10. View reports.
11. View AI demand analytics when the AI module is enabled.
12. Manage branch/profile settings.

---

## 3. Recommended Information Architecture

### Main sidebar

```text
CineReserve
[Branch Logo]
[Branch Name]

Dashboard

Cinema Management
├── Movies
├── Screens
├── Seats
└── Schedules

Bookings
├── Reservations
├── Customers
├── Payments
└── Tickets

Analytics
├── Reports
└── AI Analytics

System
└── Settings

[Admin Profile]
[Logout]
```

### Top bar

Include:
- Current page title
- Branch name
- Global search where useful
- Notifications
- Admin avatar/profile menu
- Mobile sidebar trigger

Do not add a branch selector for ordinary branch admins if the authenticated admin is restricted to one branch.

---

## 4. Global Admin Layout

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Sidebar  │ Page Title                         Notifications │ Admin Menu │
│          ├───────────────────────────────────────────────────────────────┤
│          │                                                               │
│          │ Main Page Content                                             │
│          │                                                               │
│          │                                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tablet / Small laptop
- Collapsible sidebar
- Keep tables horizontally scrollable when needed
- Use two-column form layouts only when space permits

### Mobile fallback
- Sidebar becomes a drawer
- Tables may switch to cards for essential data
- Primary action stays visible near the page heading

---

# 5. Login Page

## Goal
Provide a clean branch-admin login screen.

## Layout
- Split screen on desktop
- Left: cinematic visual / CineReserve branding
- Right: login card
- Single centered card on mobile

## Fields
- Email
- Password
- Show/hide password
- Remember me
- Forgot password
- Login button

## States
- Loading
- Invalid credentials
- Inactive account
- Network/API error

## After login
The application should load:
- Admin profile
- Assigned branch
- Branch logo/colors
- Permission/session state

Then redirect to `/dashboard`.

---

# 6. Dashboard

## Goal
Answer: "What is happening in this branch today?"

## Page header
- `Dashboard`
- Branch name
- Date
- Optional `Create Schedule` quick action

## KPI cards

Recommended:
- Today's Reservations
- Today's Revenue
- Tickets Sold
- Current / Average Occupancy

Optional secondary cards:
- Active Movies
- Today's Showtimes
- Pending Payments
- Upcoming Shows

## Main dashboard sections

### Revenue overview
Chart:
- Daily revenue
- Range selector: 7 days / 30 days / custom

### Reservation overview
Chart:
- Confirmed
- Pending
- Cancelled
- Completed

### Today's schedules
Table/card fields:
- Movie
- Screen
- Time
- Seats sold
- Capacity
- Occupancy
- Status

### Recent reservations
Fields:
- Reservation code
- Customer
- Movie
- Showtime
- Seats
- Total
- Status
- Created time

### Quick actions
- Add movie
- Add screen
- Create schedule
- View reservations

---

# 7. Movies

## Route
`/movies`

## List page

Header:
- Movies
- Search
- Status filter
- Genre filter
- `Add Movie`

### Table / card fields
- Poster
- Title
- Genres
- Duration
- Language
- Age rating
- Release date
- Status
- Actions

### Row actions
- View
- Edit
- Activate/deactivate
- Delete only if business rules permit

## Add/Edit Movie form

Fields:
- Title
- Slug
- Description
- Poster image URL/upload integration
- Trailer URL
- Duration in minutes
- Release date
- Language
- Age rating
- Genres
- Status

Use:
- Tabs or grouped sections for long forms
- Inline validation
- Confirmation dialog for destructive actions

---

# 8. Screens

## Route
`/screens`

## Screen list
Cards can work better than a dense table.

Display:
- Screen name
- Screen type
- Capacity
- Active/inactive
- Number of schedules today
- Manage Seats button

## Create/Edit Screen
Fields:
- Name
- Screen type
- Capacity
- Status

After creating a screen, guide the admin to configure its seat layout.

---

# 9. Seat Layout Manager

## Route
`/screens/[screenId]/seats`

## Goal
Allow admins to visually configure seats belonging to one screen.

## Layout

```text
Screen 1 — Seat Layout

               SCREEN
      ─────────────────────────

A     [1] [2] [3] [4]   [5] [6]
B     [1] [2] [3] [4]   [5] [6]
C     [1] [2] [3] [4]   [5] [6]

Legend:
Available Seat Setup | VIP | Disabled
```

## Seat editor capabilities
- Generate rows/seat counts
- Edit row label
- Edit seat number
- Set seat type
- Set price modifier
- Enable/disable a seat
- Preview capacity
- Save layout

## Safety
Do not silently remove seats already associated with reservations.

---

# 10. Schedules

## Route
`/schedules`

## Views
Support:
- List view
- Calendar-style view later

## Filters
- Date
- Movie
- Screen
- Status

## Schedule fields
- Movie
- Branch (display only for branch admin)
- Screen
- Show date
- Start time
- End time
- Ticket price
- Status

## Create Schedule form

Recommended interaction:
1. Select movie
2. Select screen
3. Select show date
4. Select start time
5. Calculate/suggest end time from movie duration
6. Enter ticket price
7. Check for schedule conflict
8. Save

Display conflict errors clearly before final submission.

---

# 11. Reservations

## Route
`/reservations`

## Table fields
- Reservation code
- Customer
- Movie
- Screen
- Showtime
- Seats
- Total
- Payment status
- Reservation status
- Reserved at
- Actions

## Filters
- Date range
- Reservation status
- Payment status
- Movie
- Screen
- Search by reservation code/customer

## Reservation detail drawer/page
Show:
- Reservation code
- Customer details
- Movie/showtime
- Selected seats
- Price breakdown
- Reservation status
- Payment record
- Ticket record
- Timeline

## Actions
Only expose actions supported by backend business rules:
- View
- Confirm
- Cancel
- Mark completed
- View ticket
- View payment

Use confirmation dialogs for state-changing actions.

---

# 12. Customers

## Route
`/customers`

## List fields
- Avatar
- Name
- Email
- Phone
- Reservations count
- Last booking
- Status

## Customer detail
- Profile
- Reservation history at the branch
- Reviews where relevant
- Tickets
- Payment history related to branch reservations

Avoid exposing data that is not necessary for the assigned branch.

---

# 13. Payments

## Route
`/payments`

## Table fields
- Payment reference
- Reservation code
- Customer
- Method
- Amount
- Status
- Paid at
- Created at

## Filters
- Paid
- Pending
- Failed
- Refunded
- Payment method
- Date range

## Payment detail
Show:
- Reservation link
- Payment reference
- Method
- Amount
- Status timeline
- Related ticket if confirmed

---

# 14. Tickets

## Route
`/tickets`

## Table fields
- Ticket code
- Reservation code
- Customer
- Movie
- Showtime
- Seats
- Status
- Checked-in time

## Ticket details
- QR preview
- Ticket code
- Movie
- Screen
- Showtime
- Seats
- Reservation code
- Status

Potential later action:
- Verify/check in ticket

A ticket marked as used should clearly display its `checked_in_at` value.

---

# 15. Reports

## Route
`/reports`

## Core reports
- Revenue
- Reservation volume
- Occupancy
- Popular movies

## Filters
- Date range
- Movie
- Screen

## Recommended visual layout
Top:
- Summary cards

Middle:
- Trend chart

Bottom:
- Detailed table

## Export options
Add only when backend support is ready:
- CSV
- PDF

---

# 16. AI Analytics

## Route
`/ai`

Build this after the normal reservation workflow is stable.

## Sections

### Demand prediction
Display:
- Predicted bookings
- Predicted occupancy
- Date/hour
- Schedule
- Model/version
- Prediction generated time

Visuals:
- Demand-by-hour chart
- Upcoming high-demand schedules table

### Recommendation analytics
Admin-facing analytics may show:
- Most frequently recommended movies
- Recommendation reason
- Model/version
- Recommendation usage/testing information

## Important UI labeling
When using demo/simulated AI data, clearly label it as:
`Demo / Simulated Prediction Data`

Do not present demo predictions as real production results.

---

# 17. Settings

## Route
`/settings`

## Branch profile
- Branch name
- Address
- City
- Province
- Phone
- Email
- Logo
- Primary color
- Secondary color

## Admin profile
- Name
- Email
- Phone
- Avatar
- Change password

## Branding preview
Show a live preview of:
- Sidebar accent
- Buttons
- Badges
- Logo
- Header identity

---

# 18. Reusable Components

Create reusable components instead of repeating page UI.

```text
components/
├── layout/
│   ├── AppShell
│   ├── AdminSidebar
│   ├── AdminHeader
│   └── PageContainer
├── data-display/
│   ├── DataTable
│   ├── StatCard
│   ├── StatusBadge
│   ├── EmptyState
│   └── Pagination
├── forms/
│   ├── FormField
│   ├── FormSection
│   ├── ImageUpload
│   └── DateTimeFields
├── feedback/
│   ├── ConfirmDialog
│   ├── LoadingState
│   ├── ErrorState
│   └── Toast
├── cinema/
│   ├── MovieCard
│   ├── SeatGrid
│   ├── ScheduleCard
│   ├── ReservationSummary
│   └── TicketPreview
└── charts/
    ├── RevenueChart
    ├── OccupancyChart
    └── ReservationChart
```

---

# 19. UI State Standards

Every data page should define:

### Loading
- Skeletons instead of blank screens

### Empty
Example:
`No schedules found for this date.`

Include a useful action when possible.

### Error
- Human-readable message
- Retry button
- Never expose raw backend stack traces

### Success
- Toast after successful CRUD actions

### Destructive action
- Confirmation dialog
- Clearly name the record being changed

---

# 20. Status Badge Suggestions

Use consistent semantic variants.

### General
- Active
- Inactive
- Draft

### Reservation
- Pending
- Confirmed
- Cancelled
- Completed
- Expired

### Payment
- Pending
- Paid
- Failed
- Refunded

### Ticket
- Valid
- Used
- Cancelled
- Expired

Do not rely on color alone; include text labels.

---

# 21. Recommended Admin Routes

```text
/login

/dashboard

/movies
/movies/new
/movies/[id]
/movies/[id]/edit

/screens
/screens/new
/screens/[id]
/screens/[id]/edit
/screens/[id]/seats

/schedules
/schedules/new
/schedules/[id]
/schedules/[id]/edit

/reservations
/reservations/[id]

/customers
/customers/[id]

/payments
/payments/[id]

/tickets
/tickets/[id]

/reports
/ai
/settings
```

---

# 22. API-to-UI Mapping

```text
/auth             → Login/session
/movies           → Movies UI
/genres           → Genre selectors
/screens          → Screen management
/seats            → Seat layout
/schedules        → Showtime management
/reservations     → Booking management
/payments         → Payment records
/tickets          → Ticket records
/reports          → Dashboard/report analytics
/ai               → AI dashboard
/organizations    → Organization identity when needed
/branches         → Branch identity/branding
```

---

# 23. Suggested Build Order

Build in small testable stages.

1. Admin layout shell
2. Login
3. Branch identity/branding
4. Dashboard shell
5. Movies
6. Screens
7. Seat layout
8. Schedules
9. Reservations
10. Customers
11. Payments
12. Tickets
13. Reports
14. Settings
15. AI analytics

After each module:
- connect API
- verify branch isolation
- test loading/error/empty states
- test responsive layout
- test permissions

---

# 24. Admin UI Acceptance Checklist

- [ ] Admin cannot access the portal without authentication.
- [ ] Assigned branch name/logo are visible.
- [ ] Branch colors can theme the portal.
- [ ] The portal does not trust a browser-sent branch ID for security.
- [ ] Sidebar works on desktop and mobile.
- [ ] All list pages have loading, empty, and error states.
- [ ] CRUD forms have validation.
- [ ] Tables have filters where needed.
- [ ] Seat management is visual and easy to understand.
- [ ] Schedule conflicts are surfaced clearly.
- [ ] Reservations show payment and ticket relationships.
- [ ] Reports support date filtering.
- [ ] AI pages are clearly separated from core reservation workflows.
- [ ] Simulated AI data is explicitly labeled.
- [ ] Destructive actions require confirmation.
- [ ] Statuses use text, not color alone.
