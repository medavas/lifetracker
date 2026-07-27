# server/ — 🚩 deploy/sync placeholder

Nothing runs here yet. This directory exists so the backend has a home when
you're ready to sync desktop ↔ phone. The contract it must fulfill:

## Endpoints (mirror src/lib/storage.js)

```
GET    /api/state        → the persisted zustand blob (or per-collection docs)
PUT    /api/state        → write it (last-write-wins on updatedAt)
```

Start that dumb — one blob per user is fine for a single user. Split into
/items /logs /notes only if the blob gets big enough to hurt.

## Auth (before ANYTHING else goes live)

- Preferred: WebAuthn/passkey (single user, thumbprint on phone).
  `@simplewebauthn/server` + `@simplewebauthn/browser`.
- Fallback: one bcrypt-hashed password in an env var, httpOnly session
  cookie, express-rate-limit on the login route.
- HTTPS only. Secrets in env vars. Mongo Atlas M0 with IP allowlist.

## Env (.env — never committed)

```
MONGODB_URI=
SESSION_SECRET=
RP_ID=            # webauthn relying-party id (your domain)
ORIGIN=           # https://your-domain
```
