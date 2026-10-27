# Running CinemaReserveAI on a New PC/Laptop

This project has four parts:
- `cinereserve-api` — Laravel backend (PHP)
- `cinereserve-admin` — Next.js admin panel
- `cinereserve-mobile` — Ionic/React mobile app
- `cinereserve-ai` — currently empty (only a `.venv` folder, no source yet)

## 1. Copy the project

Copy the whole `CinemaReserveAI` folder to the new machine (USB drive, cloud storage, external SSD, etc.).

To keep the transfer small, you can skip these folders — they get rebuilt automatically by the install commands below:
- `cinereserve-api/vendor`
- `cinereserve-admin/node_modules`
- `cinereserve-mobile/node_modules`
- `cinereserve-ai/.venv`
- `tmp/`

## 2. Install required software on the new machine

- **PHP 8.3+** and **Composer** — easiest via [Laragon](https://laragon.org/) on Windows (bundles PHP, Composer, and optionally PostgreSQL/Redis)
- **Node.js** (LTS version) — needed for both `cinereserve-admin` and `cinereserve-mobile`
- **PostgreSQL** (v18 used in dev) — must be running locally
- **Redis** — used for caching/queues
- **Python** — only needed once `cinereserve-ai` has actual code

## 3. Set up the backend API (`cinereserve-api`)

```bash
cd cinereserve-api
composer install
cp .env.example .env
php artisan key:generate
```

Edit `.env` and set these to match the new machine's setup:
```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=cinereserve
DB_USERNAME=postgres
DB_PASSWORD=your_new_password
```

Make sure the `cinereserve` database exists in PostgreSQL (create it manually if needed), then run:

```bash
php artisan migrate
php artisan serve
```

The API will run at `http://localhost:8000`.

## 4. Set up the admin panel (`cinereserve-admin`)

```bash
cd cinereserve-admin
npm install
```

Create a `.env.local` file with:
```
API_URL=http://localhost:8000
```

Then run:
```bash
npm run dev
```

## 5. Set up the mobile app (`cinereserve-mobile`)

```bash
cd cinereserve-mobile
npm install
npm run dev
```

## 6. Order of startup

Every time you want to run the project:
1. Start PostgreSQL and Redis (if not already running as services)
2. Start the API: `cd cinereserve-api && php artisan serve`
3. Start the admin panel: `cd cinereserve-admin && npm run dev`
4. Start the mobile app (if needed): `cd cinereserve-mobile && npm run dev`

## Notes

- No git repository is set up for this project yet, so there's no `git clone` step — the folder must be copied manually.
- If login fails with "Unable to reach the server," it usually means `php artisan serve` isn't running, or the `sessions` database table is missing (fix: `php artisan migrate`).
