# server/

See [../BACKEND_SETUP.md](../BACKEND_SETUP.md) for the actual sync API and
assistant server architecture.

This file previously described an early, unbuilt `/api/state` blob design
with WebAuthn/bcrypt auth — that design was superseded and never shipped.
The real sync implementation lives in `server/sync/` (bearer-token
`POST /sync`); the assistant server is `server.js`.
