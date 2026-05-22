# Phase 8: SignalR & Extended UI (Optional)

## Requirements
Add real-time connectivity and remaining UI/widgets deferred from core setup, only when auto-grading features require notifications, rich editors, or media players.

## Steps
1. Install deferred packages (@microsoft/signalr; optionally TipTap, Vidstack, HLS, embla, input-otp, bcryptjs, crypto-js as feature needs arise).
2. Implement SignalR hub connection module with auth token factory, reconnect handling, and singleton connection lifecycle.
3. Add SignalR hooks for connect-on-auth and notification toast handlers; wire SignalR provider into provider stack after Query provider.
4. Copy remaining UI components from UI doc (sheet, popover, tooltip, tabs, accordion, pagination, calendar, date-picker, data-table, navigation helpers, state components, SafeImage, truncated-text).
5. Add optional widget patterns from UI doc (confirm dialog, notification popover) adapted for grading domain copy.
6. Re-run validate and build; smoke-test SignalR connects when authenticated against backend hub (or document skip if API unavailable).
7. Install any additional Radix peers discovered during extended component copy.

## Success Criteria
- SignalR modules exist and provider is integrated; app builds with SignalR provider enabled.
- Extended UI components compile; component count documented against 53-item UI doc checklist.
- With backend hub running, authenticated session establishes hub connection without console fatal errors (or skip noted in README with reason).
- `npm run validate` and `npm run build` still pass after Phase 8 additions.

## Risks
- SignalR hub URL or event names differ from Beyond8 defaults: configure hub path and event handlers when backend contract is known.
- Vidstack and TipTap significantly increase bundle size: keep imports lazy or feature-flagged per route.
