# API contract (grading backend)

Assumed for frontend setup until backend confirms.

| Item | Value |
|------|--------|
| Base URL | `NEXT_PUBLIC_API_URL` (default `http://localhost:8080/`) |
| Login | `POST api/v1/auth/login` |
| Refresh | `POST api/v1/auth/refresh-token` body `{ refreshToken }` |
| Response envelope | `{ isSuccess, message, data }` |
| Login `data` | `{ accessToken, refreshToken, expiresAt?, tokenType? }` |
| JWT `role` | `string[]`; normalize `ROLE_INSTRUCTOR` → `ROLE_TEACHER` |
| Cookie | `authToken` (client-readable) |
