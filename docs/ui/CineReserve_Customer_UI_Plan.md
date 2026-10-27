# CineReserve AI — Customer App UI Plan

## 1. Purpose

The customer interface is the mobile-first CineReserve booking experience.

**Target stack**
- Ionic React
- Capacitor
- Laravel REST API

The customer app should guide users through a simple cinema-booking flow:

```text
Login / Register
      ↓
Home
      ↓
Choose Cinema
      ↓
Choose Movie
      ↓
Choose Schedule
      ↓
Choose Seats
      ↓
Checkout
      ↓
Payment
      ↓
Reservation Confirmed
      ↓
QR Ticket
```

The app can later include recommendations, reviews, history, and notifications without making the booking flow complicated.

---

# 2. Customer Navigation

Recommended bottom navigation:

```text
Home
Movies
Tickets
History
Profile
```

Recommendations can appear as a section on Home or Movies instead of requiring a permanent bottom-tab item.

Use a top back button for deeper booking screens.

---

# 3. App Entry / Splash

## Content
- CineReserve logo
- Short loading state
- Optional cinema-themed background

## Logic
On launch:
1. Check auth token/session.
2. If authenticated, go to Home.
3. If not authenticated, show Welcome / Login.

Keep splash time minimal.

---

# 4. Welcome Screen

## Goal
Quickly explain the app and lead users to authentication.

## Elements
- CineReserve logo
- Hero image
- Short line such as:
  `Book your movie seats in just a few taps.`
- `Login`
- `Create Account`
- Optional `Continue browsing` only if guest browsing is intentionally supported

---

# 5. Login

## Fields
- Email
- Password
- Show/hide password
- Forgot password
- Login button

## Secondary action
`Don't have an account? Create one`

## States
- Loading
- Invalid credentials
- Inactive account
- Network error

---

# 6. Registration

## Fields
- Full name
- Email
- Phone
- Password
- Confirm password

Optional later:
- Avatar

## UX
- Show password requirements before submission.
- Use inline validation.
- Keep the form short.
- Do not ask for branch assignment; customers normally book across participating cinemas.

---

# 7. Home

## Goal
Help the customer quickly discover movies and start a booking.

## Header
- Greeting
- Location/cinema selector entry
- Notification icon
- Optional profile avatar

## Sections

### Search
`Search movies`

### Now Showing
Horizontal movie cards:
- Poster
- Title
- Age rating
- Duration
- Genres

### Recommended for You
Show only when recommendations are available.

Each recommendation card may include a small human-readable reason such as:
`Because you watched similar movies`

### Cinemas
Cards:
- Cinema/branch name
- City/address summary
- Status if needed

### Upcoming Ticket
If the customer has an upcoming valid ticket:
- Movie
- Date/time
- Cinema
- `View Ticket`

---

# 8. Cinema Selection

## Goal
Choose the physical cinema branch.

## Card fields
- Branch logo
- Cinema/branch name
- Address
- City
- Contact number where useful

## Actions
- `View Movies`
- Tap card to select

## State
Persist the currently selected cinema during the booking flow.

The customer may change cinema before selecting a schedule.

---

# 9. Movies

## Route / screen
Movies listing

## Header
- Search
- Selected cinema
- Filter icon

## Filters
- Genre
- Language
- Age rating
- Now showing

## Movie card
- Poster
- Title
- Genre
- Duration
- Age rating
- Primary action: `View`

Use a two-column poster grid on most phones when readable.

---

# 10. Movie Detail

## Hero
- Backdrop/poster
- Title
- Age rating
- Duration
- Language
- Genres

## Content
- Synopsis
- Trailer button/link
- Release date
- Rating/review summary when available

## Showtime section
Group by date.

Example:

```text
Today
[ 1:00 PM ] [ 3:30 PM ] [ 6:00 PM ]

Tomorrow
[ 12:30 PM ] [ 4:00 PM ] [ 7:30 PM ]
```

Each time button should display or lead to:
- Cinema
- Screen
- Ticket price

Primary action after selecting a showtime:
`Choose Seats`

---

# 11. Schedule Selection

This can be part of Movie Detail or a dedicated screen.

## Display
- Movie
- Cinema
- Date
- Screen
- Start time
- End time
- Ticket price

## Status
Disable:
- Cancelled
- Completed
- Unavailable schedules

Keep selection visually obvious.

---

# 12. Seat Selection

## Goal
Make available vs selected vs unavailable seats instantly understandable.

## Header
Show booking context:
- Movie title
- Cinema
- Date/time
- Screen

## Screen indicator

```text
              SCREEN
    ──────────────────────
```

## Seat states
- Available
- Selected
- Occupied/unavailable
- VIP if applicable
- Disabled seat

Always include a text legend.

## Interaction
- Tap available seat → selected
- Tap selected seat → deselected
- Occupied seat → cannot tap
- Selected count and total update immediately

## Bottom summary
Sticky bottom area:
- `2 seats selected`
- `A3, A4`
- Running total
- `Continue`

## Important
Availability displayed by the app is not the final booking guarantee. The backend must re-check selected seats at confirmation.

If Laravel reports a seat became unavailable:
- explain the conflict
- refresh seat status
- ask the customer to choose another seat

---

# 13. Checkout

## Booking summary card
- Movie
- Cinema
- Screen
- Date
- Showtime
- Selected seats

## Price summary
- Seat subtotal
- Seat modifiers
- Discount if supported
- Final total

## Customer section
- Name
- Email
- Phone

## Payment section
Show only available methods, for example:
- Mock payment during development
- GCash when integration exists
- Card when integration exists

Primary action:
`Continue to Payment`

---

# 14. Payment

## Design
Keep this page focused and simple.

## Content
- Total amount
- Reservation reference if already created
- Payment method
- Payment instructions / provider integration

## States
- Processing
- Paid
- Failed
- Cancelled

Never allow repeated rapid submit taps.

Use:
- disabled submit button while processing
- progress indicator
- safe retry flow

---

# 15. Reservation Confirmation

## Success layout
Large success icon

Text:
`Reservation Confirmed`

Show:
- Reservation code
- Movie
- Cinema
- Screen
- Showtime
- Seats
- Amount paid / payment status

Primary:
`View QR Ticket`

Secondary:
`Back to Home`

---

# 16. QR Ticket

## Ticket card
- QR code
- Ticket code
- Reservation code
- Movie poster/title
- Cinema
- Screen
- Date
- Showtime
- Seats
- Ticket status

## Ticket status
- Valid
- Used
- Cancelled
- Expired

If used:
- show `Checked in`
- show check-in time when available

## UX
Make the QR large enough for scanning and keep it high contrast.

Optional later:
- Save ticket image
- Add to wallet when platform integration is ready

---

# 17. Tickets

## Goal
Give quick access to upcoming valid tickets.

## Sections
- Upcoming
- Used
- Cancelled/Expired

## Card content
- Movie
- Cinema
- Showtime
- Seats
- Ticket status
- `View QR`

Sort upcoming tickets by soonest showtime.

---

# 18. Reservation History

## Screen
`History`

## List item
- Movie
- Cinema
- Date/time
- Reservation code
- Amount
- Status

## Detail
- Booking summary
- Seats
- Payment
- Ticket
- Reservation timeline

Optional:
- `Write Review` after completed attendance

---

# 19. Reviews

## Entry point
From:
- completed reservation
- movie detail

## Form
- 1–5 rating
- Comment
- Submit

## Existing review
Show:
- Rating
- Comment
- Status if moderation is used
- Date

---

# 20. Recommendations

## Goal
Help customers discover movies without interrupting the normal booking flow.

## Placement
Recommended:
- Home section
- Movies section
- Dedicated page only if content volume justifies it

## Recommendation card
- Poster
- Movie title
- Genres
- Short reason
- `View Movie`

Do not expose raw model scores to ordinary customers unless there is a clear product reason.

---

# 21. Notifications

## Notification screen
Group by:
- Today
- Earlier

## Types
- Reservation confirmation
- Payment
- Showtime reminder
- Ticket update
- Other system notices

## Item
- Icon
- Title
- Message
- Timestamp
- Unread indicator

Tapping a notification should open its relevant reservation/ticket/movie when possible.

---

# 22. Profile

## Sections

### Account
- Avatar
- Full name
- Email
- Phone

### Security
- Change password
- Logout

### App
- Notifications preferences when implemented
- About
- Privacy / Terms links when available

Use separate edit screens or clear editable fields instead of making every profile field permanently editable.

---

# 23. Reusable Customer Components

```text
components/
├── layout/
│   ├── AppHeader
│   ├── BottomTabs
│   └── PageContainer
├── movies/
│   ├── MovieCard
│   ├── MoviePoster
│   ├── GenreChips
│   └── ShowtimeChip
├── cinema/
│   ├── CinemaCard
│   └── CinemaSelector
├── booking/
│   ├── SeatGrid
│   ├── SeatLegend
│   ├── BookingSummary
│   ├── PriceSummary
│   └── ReservationStatus
├── tickets/
│   ├── TicketCard
│   └── QRTicket
├── feedback/
│   ├── LoadingSkeleton
│   ├── EmptyState
│   ├── ErrorState
│   └── Toast
└── common/
    ├── SearchBar
    ├── SectionHeader
    ├── StatusBadge
    └── PrimaryButton
```

---

# 24. Mobile UX Rules

1. Make primary tap targets comfortably large.
2. Keep important buttons near the bottom thumb area.
3. Avoid dense tables.
4. Use cards, chips, lists, and bottom sheets.
5. Keep one obvious primary action per step.
6. Preserve booking context between screens.
7. Never reset selected cinema/movie unexpectedly.
8. Confirm destructive actions such as cancelling a reservation.
9. Use clear loading feedback during payment and reservation creation.
10. Do not rely only on color for seat and status meaning.

---

# 25. Empty / Loading / Error States

## Examples

### No movies
`No movies are currently available at this cinema.`

### No schedules
`No showtimes are available for this date.`

### No tickets
`You don't have any upcoming tickets yet.`

### No recommendations
Hide the section or show normal movie discovery instead.

### Network error
`We couldn't load the latest information. Please try again.`

Always provide a retry action when appropriate.

---

# 26. Recommended Customer Screen Order

Build in this sequence:

1. App shell/navigation
2. Welcome
3. Login
4. Register
5. Home
6. Cinema selection
7. Movies
8. Movie details
9. Schedule selection
10. Seat selection
11. Checkout
12. Mock payment
13. Reservation confirmation
14. QR ticket
15. Tickets
16. History
17. Profile
18. Reviews
19. Notifications
20. Recommendations

The booking path should be complete before adding advanced recommendation features.

---

# 27. API-to-UI Mapping

```text
/api/auth          → Login/register/session
/api/branches      → Cinema selection
/api/movies        → Movie discovery
/api/genres        → Movie filters
/api/schedules     → Showtime selection
/api/seats         → Seat layout/availability
/api/reservations  → Booking creation/history
/api/payments      → Payment state
/api/tickets       → QR ticket
/api/reviews       → Ratings/comments
/api/notifications → Customer notifications
/api/ai            → Recommendations
```

---

# 28. Customer UI Acceptance Checklist

- [ ] Login and registration are mobile friendly.
- [ ] Customer can browse participating cinemas.
- [ ] Customer can select a movie and showtime.
- [ ] Seat states are clear.
- [ ] Seat selection includes a legend.
- [ ] Selected seats and total update immediately.
- [ ] Backend conflicts are handled gracefully.
- [ ] Checkout summarizes the whole booking.
- [ ] Payment has processing/error/success states.
- [ ] Reservation confirmation shows the reservation code.
- [ ] Confirmed booking has a QR ticket.
- [ ] Ticket status is visible.
- [ ] Upcoming tickets are easy to find.
- [ ] History shows previous reservations.
- [ ] Notifications deep-link to useful content when possible.
- [ ] Recommendations do not block normal movie browsing.
- [ ] Screens have useful loading/empty/error states.
