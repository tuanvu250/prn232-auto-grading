# Phase 4: Redux Auth & Providers

## Requirements
Add persisted client auth state, typed Redux hooks, and a provider stack (Redux, React Query, theme-ready wrapper) without SignalR until Phase 8.

## Steps
1. Create Redux store with combined reducers, redux-persist on auth slice only, and serializable-check exceptions for persist actions.
2. Implement auth slice with login/logout/refresh async thunks, JWT decode normalizing role to array (map `ROLE_INSTRUCTOR` → `ROLE_TEACHER`), refresh token state, and auto-refresh timer helpers; on refresh **rejected**: purge persist, delete `authToken` cookie, dispatch logout, redirect to `/login`.
3. Connect auth slice to API core and cookie helpers using consistent `authToken` cookie name and secure cookie config import.
4. Add typed Redux dispatch and selector hooks.
5. Create individual providers for Redux with persist gate and React Query with devtools and default stale options.
6. Compose root Providers export with order Redux → Query → ThemeProvider placeholder slot → cross-tab auth sync; omit SignalR provider for now.
7. Add cross-tab logout sync hook listening for the global logout event dispatched on session expiry.

## Success Criteria
- Store and persistor export correctly; auth state rehydrates after page reload in browser devtools.
- Providers component wraps children without hydration errors when imported in layout (stub test page acceptable).
- Auth slice selectors and thunks type-check; loginAsync integrates with fetchAuth service.
- Provider stack does not reference SignalR modules (grep confirms no signalr imports in Phase 4 files).

## Risks
- Circular dependency between store, api core, and auth slice: follow SETUP dynamic import pattern in interceptors and refresh thunks.
- PersistGate flash of unauthenticated state: acceptable for setup; document if UX issue arises later.
