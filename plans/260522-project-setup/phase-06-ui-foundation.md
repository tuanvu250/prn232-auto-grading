# Phase 6: UI Foundation

## Requirements
Deliver a usable shadcn-style component set, theme-aware toast, and updated root layout so auth and dashboard stubs can be built immediately after setup.

## Steps
1. Confirm `lib/utils/index.ts` barrel exports `cn` from `lib/utils/cn.ts` so all UI imports use `@/lib/utils`.
2. Manually copy **16 UI primitives** from UI doc: button, card, input, textarea, select, checkbox, radio-group, switch, label, badge, avatar, skeleton, progress, table, alert, alert-dialog.
3. Add **3 essentials**: dialog, form (react-hook-form), sonner (next-themes) — **19 component files total** excluding utils.
4. Merge ThemeProvider into the providers stack with attribute class, system default, and disableTransitionOnChange per UI doc dark-mode section.
5. Update root layout: Open Sans and Quicksand with Vietnamese subsets, suppressHydrationWarning on html, metadata from env, Providers wrapper, and Toaster placement.
6. Replace scaffold home page with a minimal smoke UI using Button, Card, and toast trigger to prove component wiring.
7. Document remaining 53-component list as Phase 8 stretch; do not block Phase 7 on full catalog.

## Success Criteria
- 19 component files under `components/ui/` (16 primitives + dialog + form + sonner) import via `@/components/ui/*`.
- Root layout renders without hydration warnings; theme toggle or sonner toast can be triggered on home page.
- `npm run build` succeeds with all copied components type-checking.
- No imports reference `@/lib/utils/cn` or missing deferred packages (TipTap, Vidstack, etc.).

## Risks
- Component copy order matters (form depends on label; alert-dialog depends on button): copy in dependency order from UI doc.
- Sonner requires ThemeProvider ancestor: verify provider order before testing toasts.
