# Plan: Customer Login with Laravel Sanctum

## Goal

Implement customer login and logout using Laravel Sanctum personal access tokens.

Connect the existing Ionic `Login.tsx` page to the Laravel backend and make the existing Remember Me checkbox functional.

Keep the implementation simple, clean, and consistent with the current project.

Do NOT use Laravel `remember_token` for the customer mobile authentication flow.

---

## Current State

| Feature | Current Status |
|---|---|
| Customer registration | Working (`POST /api/register`) |
| Customer login endpoint | Does not exist |
| Customer logout endpoint | Does not exist |
| Login.tsx | UI exists but uses mock `setTimeout` |
| Remember Me checkbox | UI exists but currently does nothing |
| Customer token storage | Not implemented |
| Customer authentication state | Not implemented |
| API helper | Basic unauthenticated POST requests only |
| Admin authentication | Already uses Laravel Sanctum |
| `remember_token` | Exists in users table but unused |
| Customer protected routes | Not implemented |

---

# Important Authentication Decision

Use Laravel Sanctum personal access tokens for customer authentication.

Do NOT use:

- Laravel `remember_token`
- `Auth::attempt(..., $remember)`
- session-based Remember Me authentication

The customer Ionic app should authenticate using:

Authorization: Bearer <sanctum-token>

The existing `remember_token` database column will remain untouched.

---

# Backend Changes

## 1. CustomerAuthController.php

File:

cinereserve-api/app/Http/Controllers/Api/CustomerAuthController.php

The controller already handles registration.

Add:

- login()
- logout()

Do not modify working registration functionality unless necessary.

---

## 2. Customer Login Method

Add:

login(Request $request)

### Validation

Validate:

- email
  - required
  - valid email

- password
  - required
  - string

Normalize the email:

strtolower(trim($request->email))

---

## 3. Find Customer

Find the user using the normalized email.

Example flow:

email
→ find User
→ verify password
→ verify customer role
→ verify active status
→ create Sanctum token

Do NOT allow the frontend to specify the role.

The backend must verify:

role === "customer"

---

## 4. Credential Verification

Use Laravel's secure password verification:

Hash::check()

Credential failures should all return the same response.

These cases:

- email does not exist
- password is incorrect
- account belongs to admin
- account belongs to staff
- role is not customer

should return:

HTTP 401

{
  "message": "Invalid email or password."
}

Do not expose whether a specific email exists.

---

## 5. Inactive Customer

If:

status !== "active"

return:

HTTP 403

{
  "message": "Your account is inactive."
}

Do not create a token.

---

## 6. Create Sanctum Token

After successful validation:

$user->createToken('customer-app')->plainTextToken

Return:

HTTP 200

{
  "token": "...",
  "user": {
    "id": ...,
    "name": "...",
    "email": "...",
    "phone": "...",
    "role": "customer"
  }
}

Do NOT return:

- password
- password hash
- remember_token
- database information
- unnecessary internal fields

---

## 7. Login Error Handling

Unexpected backend errors should be logged by Laravel.

The customer should only receive a safe response:

HTTP 500

{
  "message": "Unable to sign in. Please try again."
}

Never expose:

- SQL queries
- PostgreSQL errors
- database name
- host
- port
- stack traces
- Laravel exception details

---

# Customer Logout

## 8. logout(Request $request)

Use the authenticated Sanctum user.

Delete only the token used for the current request:

$request->user()->currentAccessToken()?->delete();

Then return:

HTTP 204 No Content

Do not delete all user tokens unless specifically required later.

---

# API Routes

## 9. routes/api.php

Add:

Route::post('/customer/login', [CustomerAuthController::class, 'login'])
    ->middleware('throttle:10,1');

Route::post('/customer/logout', [CustomerAuthController::class, 'logout'])
    ->middleware('auth:sanctum');

Important:

Use:

auth:sanctum

Do NOT write:

auth\:sanctum

The backslash is only Markdown escaping and must not appear in PHP code.

---

# Frontend Changes

## 10. API Helper

File:

cinereserve-mobile/src/lib/api.ts

Keep the existing API helper.

Add support for customer authentication.

---

# Token Storage Design

## 11. Temporary Session Token

Create a module-level variable:

let sessionToken: string | null = null;

This stores a token temporarily while the current Ionic web app session is running.

This is needed when Remember Me is NOT checked.

---

## 12. Persistent Token

Use the existing browser storage for the current implementation:

localStorage

Key:

cinereserve_token

Important:

Do not add a new npm package just for token storage.

For the current development stage, reuse the existing browser environment.

Native secure storage can be considered later when packaging the application as a production mobile app.

---

# Token Helper Functions

## 13. getToken()

Behavior:

1. If `sessionToken` exists, return it.
2. Otherwise check localStorage.
3. Return the persisted token if available.
4. Otherwise return null.

Concept:

getToken()
→ sessionToken
→ localStorage
→ null

---

## 14. setToken(token, remember)

This function must ALWAYS keep the token available for the current session.

Behavior:

If Remember Me = true:

- set sessionToken
- save token to localStorage

If Remember Me = false:

- set sessionToken
- remove any existing persisted token from localStorage

Important:

Do NOT make `setToken(token, false)` do nothing.

The application still needs the token after redirecting to `/home`.

---

## 15. clearToken()

Clear both locations:

- sessionToken = null
- remove `cinereserve_token` from localStorage

This prevents old remembered sessions from remaining active.

---

# API Authentication Helpers

## 16. apiPostAuth()

Add an authenticated POST helper.

It should send:

Authorization: Bearer <token>

and:

Content-Type: application/json
Accept: application/json

Do not duplicate unnecessary request logic if the existing API helper can be reused cleanly.

---

## 17. Logout API Helper

Add a helper capable of calling:

POST /customer/logout

with:

Authorization: Bearer <token>

The endpoint returns:

204 No Content

Do not attempt to parse JSON from a 204 response.

---

# Login.tsx

File:

cinereserve-mobile/src/pages/Login.tsx

## 18. Remove Mock Login

Remove the existing fake login behavior such as:

setTimeout(...)

Replace it with the real API call.

---

## 19. Login Request

Call:

POST /customer/login

Body:

{
  email,
  password
}

Do NOT send:

- role
- remember_token
- customer role
- admin role
- staff role

The backend determines whether the account is a customer.

---

## 20. Successful Login

After receiving:

{
  token,
  user
}

call:

setToken(response.token, remember)

Then redirect to:

/home

Keep the existing UI and styling unchanged.

---

# Remember Me Behavior

## Remember Me Checked

Flow:

Login
→ Sanctum token returned
→ token stored in sessionToken
→ token stored in localStorage
→ redirect to Home

Result:

Customer remains authenticated after:

- browser reload
- closing and reopening the app/webview
- application restart

until:

- logout
- token expires/revoked
- local storage is cleared

---

## Remember Me Unchecked

Flow:

Login
→ Sanctum token returned
→ token stored only in sessionToken
→ persisted token removed from localStorage
→ redirect to Home

Result:

Customer remains authenticated during the current SPA session.

The token disappears when the app/browser session is fully restarted or refreshed.

---

# Important Remember Me Fix

Do NOT implement:

setToken(token, false)
→ do nothing

That would cause this problem:

Login successful
→ redirect /home
→ no token available
→ authenticated API requests fail
→ logout cannot call backend

Instead:

Remember Me false
→ token stays in memory
→ authenticated requests still work
→ token is not persisted

---

# Home.tsx

File:

cinereserve-mobile/src/pages/Home.tsx

## 21. Add Logout Functionality

Use:

getToken()
clearToken()
apiPostAuthLogout()

Logout flow:

1. Get current token.
2. If token exists, call backend logout.
3. Backend revokes current Sanctum token.
4. Clear local authentication state.
5. Redirect to `/login`.

---

## 22. Safe Logout Behavior

Even if:

- token is missing
- token is expired
- API logout fails
- server is unavailable

the frontend should still clear the local token and redirect to Login.

Do not trap the customer on the Home page because logout API failed.

Use a `finally` style flow if appropriate:

try
→ backend logout

finally
→ clearToken()
→ redirect /login

---

# Customer Protected Requests

## 23. Authorization Header

Any future authenticated customer API request should use:

Authorization: Bearer <token>

Token source:

getToken()

Do not manually read localStorage throughout different pages.

Use the central token helper.

---

# Optional Route Protection

Do not build a large authentication framework yet.

But if the project already has a clean route guard pattern, Home can check:

getToken()

If no token exists:

redirect to /login

Keep this minimal.

Do not create unnecessary global state or authentication libraries.

---

# Security Requirements

- Use Laravel Sanctum.
- Use Hash::check() for password verification.
- Never compare password strings manually.
- Never expose password hashes.
- Never expose remember_token.
- Never expose SQL/database errors.
- Do not accept role from the frontend.
- Backend must verify `role === 'customer'`.
- Backend must verify account status.
- Rate-limit customer login.
- Logout should revoke the current token.
- Do not modify admin authentication.
- Do not modify registration logic unnecessarily.
- Do not use Laravel remember_token.
- Do not create migrations.
- Do not change the database schema.
- Do not install unnecessary packages.

---

# Files Expected to Change

## Backend

cinereserve-api/app/Http/Controllers/Api/CustomerAuthController.php

Changes:
- add login()
- add logout()

cinereserve-api/routes/api.php

Changes:
- POST /api/customer/login
- POST /api/customer/logout

## Frontend

cinereserve-mobile/src/lib/api.ts

Changes:
- sessionToken
- getToken()
- setToken()
- clearToken()
- authenticated API helper
- logout API helper

cinereserve-mobile/src/pages/Login.tsx

Changes:
- remove mock login
- call real API
- store token
- connect Remember Me
- redirect to Home

cinereserve-mobile/src/pages/Home.tsx

Changes:
- add logout functionality
- clear authentication token
- redirect to Login

---

# Files / Systems That Must NOT Change

Do NOT modify:

- database migrations
- users table schema
- remember_token column
- customer registration UI
- working registration logic unless absolutely necessary
- AdminAuthController
- admin routes
- admin authentication
- admin portal
- password hashing configuration unless a real issue is discovered
- unrelated pages
- unrelated components

Do NOT:

- add npm packages
- add Composer packages
- run database migrations
- run seeders
- create test users
- modify database records
- run automated registration/login tests

I will perform manual testing myself.

---

# Complete Login Flow

Customer enters:

Email
Password
Remember Me

↓

Login.tsx validates basic fields

↓

POST /api/customer/login

↓

Laravel validates request

↓

Find user by normalized email

↓

Verify password with Hash::check()

↓

Verify role = customer

↓

Verify status = active

↓

Generate Sanctum personal access token

↓

Return safe user data + token

↓

Frontend calls:

setToken(token, remember)

↓

Remember checked:
session memory + localStorage

Remember unchecked:
session memory only

↓

Redirect to /home

↓

Authenticated requests send:

Authorization: Bearer <token>

---

# Complete Logout Flow

Customer taps Logout

↓

getToken()

↓

POST /api/customer/logout

Authorization: Bearer <token>

↓

Laravel Sanctum authenticates customer

↓

Delete current access token

↓

Frontend clearToken()

↓

Remove:
- session token
- localStorage token

↓

Redirect to /login

---

# Expected API Responses

## Successful Login

HTTP 200

{
  "token": "...",
  "user": {
    "id": 4,
    "name": "Test Customer",
    "email": "customer@example.com",
    "phone": "09123456789",
    "role": "customer"
  }
}

## Invalid Credentials

HTTP 401

{
  "message": "Invalid email or password."
}

## Inactive Customer

HTTP 403

{
  "message": "Your account is inactive."
}

## Unexpected Error

HTTP 500

{
  "message": "Unable to sign in. Please try again."
}

## Logout

HTTP 204

No response body.

---

# Manual Testing Checklist

I will manually test these after implementation:

1. Login using a valid customer account.
2. Confirm redirect to `/home`.
3. Login using an incorrect password.
4. Login using an email that does not exist.
5. Try an Admin account through customer login.
6. Try a Staff account through customer login.
7. Try an inactive customer.
8. Check Remember Me.
9. Confirm token appears in localStorage.
10. Restart/reload and verify remembered login behavior.
11. Uncheck Remember Me.
12. Confirm token is not persisted in localStorage.
13. Confirm customer still works during the current session.
14. Logout.
15. Confirm backend Sanctum token is revoked.
16. Confirm local token is cleared.
17. Confirm redirect to Login.
18. Confirm registration still works.
19. Confirm Admin authentication still works unchanged.

---

# Implementation Rules

Before changing code:

1. Review the existing CustomerAuthController.
2. Review the existing Admin Sanctum authentication as a reference.
3. Review routes/api.php.
4. Review src/lib/api.ts.
5. Review Login.tsx.
6. Review Home.tsx.
7. Reuse existing patterns whenever possible.

Then implement only the smallest necessary changes.

Keep the code simple, readable, and maintainable.

After implementation, provide a short summary containing:

- Files modified
- Files added, if any
- Customer routes added
- How login works
- How Sanctum token creation works
- How Remember Me works
- Where temporary tokens are stored
- Where remembered tokens are stored
- How authenticated requests work
- How logout works
- Any security protections added
- What I should manually test

Do not run tests or database commands. I will test everything manually.