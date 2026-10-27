# CinemaReserveAI — Project Structure

```
CinemaReserveAI/
│
├── docs/
│   ├── PROJECT_STRUCTURE.md                        # This file — project tree overview
│   ├── SETUP.md                                    # Setup guide for running on new machine
│   │
│   ├── plans/
│   │   └── PLAN-customer-login.md                  # Customer login/logout plan (Sanctum)
│   │
│   └── ui/
│       ├── CineReserve_UI_Design_System_Plan.md    # Design system spec (766 lines)
│       ├── CineReserve_Admin_Portal_UI_Plan.md     # Admin portal UI plan (~834 lines)
│       └── CineReserve_Customer_UI_Plan.md         # Customer app UI plan (~737 lines)
│
├── cinereserve-api/                            # Laravel 13 PHP backend
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   └── Controller.php
│   │   │   └── Controllers/Api/
│   │   │       ├── AdminAuthController.php    # Login, logout, me, profile, avatar
│   │   │       ├── BranchController.php       # Branch update, logo upload
│   │   │       ├── GenreController.php        # Genre listing and creation
│   │   │       └── MovieController.php        # Movie CRUD with poster upload
│   │   ├── Models/
│   │   │   ├── Branch.php
│   │   │   ├── Genre.php
│   │   │   ├── Movie.php
│   │   │   ├── Organization.php
│   │   │   └── User.php
│   │   └── Providers/
│   │       └── AppServiceProvider.php
│   │
│   ├── bootstrap/
│   │   ├── app.php
│   │   └── providers.php
│   │
│   ├── config/
│   │   ├── app.php
│   │   ├── auth.php
│   │   ├── cache.php
│   │   ├── database.php
│   │   ├── filesystems.php
│   │   ├── hashing.php
│   │   ├── logging.php
│   │   ├── mail.php
│   │   ├── sanctum.php
│   │   ├── services.php
│   │   └── session.php
│   │
│   ├── database/
│   │   ├── factories/
│   │   │   └── UserFactory.php
│   │   ├── migrations/
│   │   │   ├── 0001_01_01_000000_create_users_table.php
│   │   │   ├── 0001_01_01_000001_create_cache_table.php
│   │   │   ├── 0001_01_01_000002_create_jobs_table.php
│   │   │   ├── 2026_03_10_100000_create_organizations_table.php
│   │   │   ├── 2026_03_10_100001_create_branches_table.php
│   │   │   ├── 2026_03_10_100002_create_genres_table.php
│   │   │   ├── 2026_03_10_100003_create_movies_table.php
│   │   │   ├── 2026_03_10_100004_create_movie_genres_table.php
│   │   │   ├── 2026_03_10_100005_create_screens_table.php
│   │   │   ├── 2026_03_10_100006_create_seats_table.php
│   │   │   ├── 2026_03_10_100007_create_schedules_table.php
│   │   │   ├── 2026_03_10_100008_create_reservations_table.php
│   │   │   ├── 2026_03_10_100009_create_reservation_seats_table.php
│   │   │   ├── 2026_03_10_100010_create_payments_table.php
│   │   │   ├── 2026_03_10_100011_create_tickets_table.php
│   │   │   ├── 2026_03_10_100012_create_reviews_table.php
│   │   │   ├── 2026_03_10_100013_create_notifications_table.php
│   │   │   ├── 2026_03_10_100014_create_movie_interactions_table.php
│   │   │   ├── 2026_03_10_100015_create_ai_demand_predictions_table.php
│   │   │   ├── 2026_03_10_100016_create_ai_recommendation_logs_table.php
│   │   │   ├── 2026_03_10_100017_create_sessions_table.php
│   │   │   └── 2026_03_10_100018_create_personal_access_tokens_table.php
│   │   └── seeders/
│   │       ├── DatabaseSeeder.php              # Seeds admin, branch, genres
│   │       ├── GenreSeeder.php                 # 20 standard movie genres
│   │       └── ReelWorldBranchSeeder.php       # Reel World Cinema branch data
│   │
│   ├── public/
│   │   ├── .htaccess
│   │   ├── favicon.ico
│   │   └── index.php
│   │
│   ├── resources/
│   │   └── views/
│   │       └── components/
│   │
│   ├── routes/
│   │   ├── api.php                             # 11 API routes
│   │   ├── console.php
│   │   └── web.php
│   │
│   ├── storage/
│   │   ├── app/
│   │   ├── framework/
│   │   └── logs/
│   │
│   ├── tests/
│   │   ├── TestCase.php
│   │   ├── Feature/
│   │   │   ├── CinemaSchemaTest.php            # 6 schema validation tests
│   │   │   ├── ExampleTest.php
│   │   │   └── MovieControllerTest.php         # 2 movie API tests
│   │   └── Unit/
│   │
│   ├── vendor/
│   │
│   ├── .env                                    # DB, Redis, mail config
│   ├── .env.example
│   ├── artisan
│   ├── composer.json
│   ├── composer.lock
│   ├── package.json
│   ├── phpunit.xml
│   └── vite.config.js
│
├── cinereserve-admin/                           # Next.js 16 admin portal
│   ├── app/
│   │   ├── page.tsx                             # Login page
│   │   ├── layout.tsx                           # Root layout (dark mode, Poppins)
│   │   ├── globals.css                          # Tailwind + shadcn theme
│   │   │
│   │   ├── api/admin/                           # Proxy routes to Laravel
│   │   │   ├── login/route.ts                   # POST — login, sets cookie
│   │   │   ├── logout/route.ts                  # POST
│   │   │   ├── me/route.ts                      # GET — auth check
│   │   │   ├── movies/route.ts                  # GET + POST
│   │   │   ├── genres/route.ts                  # GET + POST
│   │   │   ├── branch/
│   │   │   │   ├── route.ts                     # PATCH
│   │   │   │   └── logo/route.ts                # POST
│   │   │   └── profile/
│   │   │       ├── route.ts                     # PATCH
│   │   │       └── avatar/route.ts              # POST
│   │   │
│   │   └── dashboard/
│   │       ├── page.tsx                         # Dashboard overview (KPI cards)
│   │       ├── layout.tsx                       # Dashboard shell (sidebar, header)
│   │       ├── movies/
│   │       │   ├── page.tsx                     # Movie catalog
│   │       │   └── new/page.tsx                 # New movie form
│   │       ├── screens/page.tsx                 # Placeholder
│   │       ├── seats/page.tsx                   # Placeholder
│   │       ├── schedules/page.tsx               # Placeholder
│   │       ├── reservations/page.tsx            # Placeholder
│   │       ├── customers/page.tsx               # Placeholder
│   │       ├── payments/page.tsx                # Placeholder
│   │       ├── tickets/page.tsx                 # Placeholder
│   │       ├── reports/page.tsx                 # Placeholder
│   │       ├── ai-analytics/page.tsx            # Placeholder
│   │       └── settings/
│   │           ├── page.tsx                     # Settings hub
│   │           ├── branch/page.tsx              # Branch profile + logo
│   │           └── profile/page.tsx             # Admin profile + avatar
│   │
│   ├── components/
│   │   ├── ui/                                  # shadcn/ui primitives
│   │   │   ├── alert.tsx
│   │   │   ├── button.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── input.tsx
│   │   │   └── label.tsx
│   │   └── dashboard/
│   │       └── empty-state.tsx
│   │
│   ├── lib/
│   │   ├── dashboard-nav.ts                     # Nav config, module metadata
│   │   └── utils.ts                             # cn() utility
│   │
│   ├── proxy.ts                                 # Middleware: protects /dashboard/*
│   │
│   ├── public/
│   │   ├── logo.svg
│   │   └── background/
│   │
│   ├── .env.local                               # API_URL=http://localhost:8000
│   ├── components.json                          # shadcn/ui config
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── postcss.config.mjs
│   └── eslint.config.mjs
│
├── cinereserve-mobile/                          # Ionic React customer app
│   ├── src/
│   │   ├── App.tsx                              # Routes: /home, /login, /register
│   │   ├── App.test.tsx                         # Smoke test
│   │   ├── main.tsx                             # Entry point
│   │   ├── setupTests.ts                        # jest-dom + matchMedia mock
│   │   │
│   │   ├── pages/
│   │   │   ├── Home.tsx                         # Hero, Coming Soon, bottom nav
│   │   │   ├── Home.css
│   │   │   ├── Login.tsx                        # Login form
│   │   │   ├── Register.tsx                     # Registration + password strength
│   │   │   └── AuthForm.css
│   │   │
│   │   ├── components/                          # (empty)
│   │   │
│   │   ├── assets/
│   │   │
│   │   └── theme/
│   │       └── variables.css                    # Ionic theme variables
│   │
│   ├── cypress/
│   │   ├── e2e/
│   │   │   └── test.cy.ts                      # Placeholder E2E test
│   │   ├── fixtures/
│   │   └── support/
│   │
│   ├── dist/                                    # Built output
│   │
│   ├── capacitor.config.ts                      # appId: io.ionic.starter
│   ├── cypress.config.ts                        # baseUrl: localhost:5173
│   ├── ionic.config.json                        # type: react-vite
│   ├── vite.config.ts                           # Vitest config, chunk splitting
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.js
│   └── .browserslistrc
│
└── cinereserve-ai/                              # Python AI module (placeholder)
    └── .venv/                                   # Virtual environment
```
