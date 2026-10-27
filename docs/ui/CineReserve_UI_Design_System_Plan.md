# CineReserve AI — UI Design System Plan

## 1. Design Direction

Use a **modern cinematic interface** that is polished but simple enough for a beginner-friendly implementation.

The system has two presentation contexts:

1. **Admin Portal**
   - Information-dense
   - Professional
   - Fast CRUD and monitoring workflows
   - Desktop-first but responsive

2. **Customer App**
   - Visual
   - Mobile-first
   - Movie-poster driven
   - Short, guided booking steps

Both should feel like one CineReserve product family.

---

# 2. Multi-Client Branding Strategy

The admin portal is shared across different cinema clients/branches.

Branch data can provide:
- Logo
- Primary color
- Secondary color
- Branch name

Use CSS variables instead of hardcoding each client's colors throughout the UI.

Example:

```css
:root {
  --brand-primary: #7c3aed;
  --brand-secondary: #a78bfa;
  --brand-primary-foreground: #ffffff;
}
```

At login/session bootstrap, load the branch branding and map it to variables.

Keep semantic colors independent from brand colors.

For example:
- Success should remain a success semantic token.
- Error should remain an error semantic token.
- Warning should remain a warning semantic token.

Do not turn every status badge into the branch's primary color.

---

# 3. Proposed Base Theme

This is a design proposal, not a database requirement.

## Dark cinematic foundation
Recommended for customer surfaces:
- Background: very dark neutral
- Surface: slightly lighter neutral
- Text: near-white
- Muted text: cool gray
- Primary: branch brand color or CineReserve accent

## Admin foundation
Recommended:
- Neutral/light work surface by default
- Optional dark mode later
- Branch primary color used for selected navigation, primary buttons, highlights, and charts

This keeps administration readable during long work sessions while allowing the customer app to feel more cinematic.

---

# 4. Color Token Structure

Use semantic variables.

```text
Background
--background
--surface
--surface-elevated
--border

Text
--foreground
--muted-foreground

Brand
--brand-primary
--brand-secondary
--brand-primary-foreground

State
--success
--warning
--danger
--info

Cinema Seat States
--seat-available
--seat-selected
--seat-occupied
--seat-disabled
--seat-vip
```

Do not encode meaning with color only.

Pair color with:
- text
- icon
- shape/border
- legend

---

# 5. Typography

## Recommended family
Use one clean sans-serif family across the system.

Examples:
- Geist
- Inter
- system sans-serif fallback

## Scale

```text
Display      32–40px
Page Title   28–32px
Section      20–24px
Card Title   16–18px
Body         14–16px
Small        12–14px
Caption      12px
```

## Rules
- Keep body text at least 14px.
- Prefer 16px for mobile input fields.
- Use medium/semibold weights for headings.
- Avoid excessive all-caps text.
- Keep long synopsis text comfortably spaced.

---

# 6. Spacing System

Use a consistent 4px base scale.

```text
4   xs
8   sm
12  md
16  lg
24  xl
32  2xl
48  3xl
64  4xl
```

Common usage:
- Card padding: 16–24px
- Section gap: 24–32px
- Page outer padding:
  - mobile: 16px
  - tablet: 24px
  - desktop: 24–32px

---

# 7. Border Radius

Suggested:
- Small controls: 8px
- Buttons/inputs: 10px
- Cards: 12–16px
- Bottom sheets/dialogs: 16px+
- Movie poster cards: 12px

Avoid mixing many unrelated radius sizes.

---

# 8. Elevation

Use subtle shadows.

Admin:
- Mostly border-based separation
- Light elevation for dropdowns, dialogs, floating cards

Customer:
- Slightly more depth for movie cards, checkout sheet, and ticket card

Avoid heavy shadows on every component.

---

# 9. Iconography

Use one icon family consistently.

Examples:
- Lucide
- Ionicons for Ionic-native usage

Core icon categories:
- Home
- Movie
- Cinema
- Calendar
- Seat/ticket
- Reservation
- Payment
- Reports
- AI/sparkles
- Settings
- Notifications
- Profile
- Search
- Filter
- Edit
- Delete
- More actions

Do not mix multiple icon styles on the same screen.

---

# 10. Button System

## Primary
For the main action:
- Book Now
- Continue
- Save
- Create Schedule
- Confirm Payment

## Secondary
For optional actions:
- View Details
- Cancel
- Edit

## Destructive
For:
- Delete
- Cancel reservation when irreversible

## Button states
Every button should have:
- default
- hover (web)
- active
- focus
- disabled
- loading

Never allow double submission during critical reservation/payment actions.

---

# 11. Input System

Common fields:
- Text
- Email
- Password
- Number
- Date
- Time
- Select
- Combobox
- Textarea
- Image input
- Color input for branch branding

Rules:
- Label every field.
- Show validation near the field.
- Preserve entered values after validation failure.
- Mark optional fields clearly.
- Use helper text for confusing fields.

---

# 12. Card System

## Admin cards
Types:
- KPI card
- Content card
- Chart card
- Table container
- Settings group

## Customer cards
Types:
- Movie card
- Cinema card
- Showtime card/chip
- Reservation card
- Ticket card
- Recommendation card

Keep card styling consistent by role rather than inventing a new look for each page.

---

# 13. Table Design — Admin

Tables should support:
- Clear headers
- Row hover
- Search
- Filters
- Pagination
- Loading skeleton
- Empty state
- Status badge
- Actions menu

For small screens:
- allow horizontal scrolling, or
- switch the most important datasets to stacked cards

Do not shrink text until the table becomes unreadable.

---

# 14. Status Design

## Reservation
```text
Pending
Confirmed
Cancelled
Completed
Expired
```

## Payment
```text
Pending
Paid
Failed
Refunded
```

## Ticket
```text
Valid
Used
Cancelled
Expired
```

## General records
```text
Draft
Active
Inactive
```

Each status badge should include readable text.

---

# 15. Seat Design Language

Seats need stronger visual differentiation than ordinary buttons.

## Seat states
- Available
- Selected
- Occupied
- Disabled
- VIP

Recommended treatment:
- Available: outline
- Selected: filled brand accent + check state
- Occupied: muted/fill + non-interactive
- Disabled: low contrast + disabled marker
- VIP: distinct label/icon/border

Show a legend on every seat-selection interface.

Admin seat setup and customer seat selection should use the same basic seat shape so the system feels consistent.

---

# 16. Ticket Design

The digital ticket should be visually recognizable as a ticket.

Include:
- QR region
- Movie identity
- Cinema
- Screen
- Date/time
- Seats
- Ticket code
- Reservation code
- Status

Use a strong visual separation around QR code so scanning remains reliable.

Avoid placing decorative graphics directly behind the QR.

---

# 17. Movie Poster Usage

Poster imagery is a major part of the customer experience.

Rules:
- Use a fixed poster aspect ratio.
- Crop consistently.
- Provide a placeholder for missing posters.
- Keep title text outside the image when possible.
- Do not place too much small text over busy poster images.

Admin tables can use small thumbnails; customer screens can use larger poster cards.

---

# 18. Navigation Patterns

## Admin
Desktop:
- Persistent left sidebar
- Top bar

Mobile:
- Drawer sidebar

## Customer
- Bottom tab navigation for top-level pages
- Stack/back navigation for booking flow
- Sticky bottom primary action during booking

Do not put every booking step into the bottom navigation.

---

# 19. Responsive Breakpoints

Suggested conceptual breakpoints:

```text
Mobile       < 640px
Tablet       640–1023px
Desktop      1024–1439px
Wide         >= 1440px
```

Design first for:
- Customer: mobile
- Admin: 1366px desktop and common laptop widths

Then verify tablet behavior.

---

# 20. Feedback & Motion

Use motion to explain state, not decorate everything.

Recommended:
- 150–250ms transitions
- Button loading spinner
- Dialog fade/scale
- Bottom sheet slide
- Seat selection micro-feedback
- Skeleton loading

Respect reduced-motion preferences.

Avoid large cinematic transitions that delay task completion.

---

# 21. Accessibility

Minimum standards:
- Visible keyboard focus
- Sufficient contrast
- Labels for inputs
- Accessible button names
- Logical heading hierarchy
- Status not communicated only by color
- Seat states readable with text/ARIA labels
- QR ticket text details available even if QR cannot be scanned
- Touch targets approximately 44px or larger for mobile controls

---

# 22. Loading Patterns

## Admin
Use:
- table skeletons
- KPI skeletons
- chart placeholders

## Customer
Use:
- poster-card skeletons
- seat-grid loading state
- booking summary skeleton

Avoid full-page blocking loaders unless the entire session/app is being initialized.

---

# 23. Empty State Pattern

Every empty state should contain:

1. Simple icon/illustration
2. Clear sentence
3. Helpful next action when relevant

Examples:

Admin:
`No schedules yet. Create your first showtime.`

Customer:
`No showtimes are available for this date.`

---

# 24. Error Pattern

Show:
- plain-language message
- retry action
- fallback navigation if necessary

Never show:
- Laravel stack traces
- SQL errors
- raw API exception payloads

Critical booking/payment errors should preserve as much user context as safely possible.

---

# 25. Dialog / Drawer Rules

Use dialogs for:
- confirmations
- short forms
- destructive actions

Use drawers/sheets for:
- mobile filters
- quick details
- secondary actions

Use full pages for:
- large edit forms
- seat management
- reservation details
- complex reports

---

# 26. Page Header Pattern

Admin page header:

```text
[Page Title]                     [Primary Action]
Short supporting description
```

Optional filters sit below.

Customer screen header:

```text
[Back]   Screen Title         [Optional Action]
```

For immersive movie detail pages, the title may be integrated into the hero section.

---

# 27. Dashboard Chart Rules

Charts should answer a specific question.

Examples:
- Revenue over time
- Reservations over time
- Occupancy by schedule
- Demand by hour

Rules:
- Label axes where needed.
- Provide tooltips.
- Show an empty state instead of a meaningless chart.
- Avoid too many chart colors.
- Use branch brand color as an accent, not as the only distinction between multiple data series.

---

# 28. Branch Branding Rules

Good places for branch branding:
- Admin sidebar logo
- Login identity
- Primary button
- Active navigation item
- Selected tabs
- Accent lines
- Chart primary series

Avoid:
- recoloring all semantic status indicators
- placing branch colors behind long body text
- using low-contrast brand colors without an accessible foreground token

---

# 29. Component Naming Guidance

Keep component names task-based.

Good:
```text
MovieCard
CinemaCard
ShowtimeChip
SeatGrid
TicketCard
ReservationSummary
RevenueChart
StatusBadge
```

Avoid vague names:
```text
Box1
Content2
CoolCard
SectionThing
```

---

# 30. Design-to-Code Structure

## Admin
```text
components/
  ui/            # shadcn/ui primitives
  layout/
  data-display/
  forms/
  cinema/
  booking/
  charts/
```

## Customer
```text
components/
  common/
  layout/
  movies/
  cinema/
  booking/
  tickets/
  feedback/
```

Keep API calls outside visual components where practical.

---

# 31. Suggested UI Build Milestones

## Milestone 1 — Design foundation
- Tokens
- Typography
- Buttons
- Inputs
- Cards
- Badges
- Dialogs
- Navigation shells

## Milestone 2 — Admin core
- Login
- Sidebar/topbar
- Dashboard
- Movies
- Screens
- Seats
- Schedules

## Milestone 3 — Booking administration
- Reservations
- Payments
- Tickets
- Customers

## Milestone 4 — Customer booking
- Auth
- Home
- Cinema
- Movies
- Schedule
- Seats
- Checkout
- Payment
- Ticket

## Milestone 5 — Secondary features
- History
- Reviews
- Notifications
- Reports
- Settings

## Milestone 6 — AI
- Recommendations UI
- Demand prediction UI
- AI labels and explanation states

---

# 32. Final Design Checklist

- [ ] Admin and customer apps visually belong to the same product.
- [ ] Admin remains readable and efficient.
- [ ] Customer booking is a short guided flow.
- [ ] Branch branding is tokenized.
- [ ] Semantic status colors remain consistent.
- [ ] Seat states are easy to distinguish.
- [ ] Customer primary actions are thumb-friendly.
- [ ] All interactive elements have focus/disabled/loading states.
- [ ] Tables are usable on laptops.
- [ ] Mobile layouts avoid dense desktop tables.
- [ ] QR tickets are scanner friendly.
- [ ] Empty/error/loading states are designed, not added later.
- [ ] AI features are visually separated from core reservation features.
- [ ] Demo AI data is clearly labeled.
- [ ] The design does not rely on color alone.
