# Pre-Alpha Tech Debt Inventory
Generated: 2026-05-21

## TODO / FIXME / XXX in `src/`

```
(none)
```

`grep -rn "TODO\|FIXME\|XXX" src/` returned no matches. Codebase is annotation-clean.

---

## TypeScript (`npx tsc --noEmit`)

```
(no errors or warnings)
```

All 0 type errors. Build produces clean output.

---

## Build warnings (Rollup / Vite)

Three `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings in `npm run build`:

| File dynamically imported | Reason ineffective |
|---|---|
| `src/ui/sandbox-ui.ts` in `sandbox.ts` | Also statically imported by `deploy-ui.ts` and `sandbox-boot.ts` |
| `src/ui/win-overlay.ts` in `sandbox.ts` | Also statically imported by `sandbox-boot.ts` |
| `src/ui/sandbox-boot.ts` in `sandbox.ts` | Also statically imported by `online-match.ts` |

**Impact**: Minor — the dynamic `import(...)` calls in `sandbox.ts` were intended to lazy-load these modules, but Rollup can't split them into a separate chunk because they're also statically required. They end up in the main bundle anyway. No functional problem.

**Fix when ready**: Replace the `import('…').then(…)` pattern in `sandbox.ts` with static imports at the top, since they're not actually deferred. This is a cleanup, not a bug.

---

## `console.*` calls in `src/`

All three are intentional error/warn guards in `src/app/screens/online-match.ts`:

| Line | Call | Purpose |
|---|---|---|
| 278 | `console.warn('queueLocalDeployment rejected — already readied?')` | Defensive: rejected deploy queue |
| 285 | `console.error('submitMyReady failed', e)` | Surfaced async failure |
| 292 | `console.warn('onExecutionEnd persistence failed', e)` | Non-fatal persistence failure |

These are appropriate production guards. No leftover debug logs.

---

## Unused exports (spot-check)

Exported symbols that are not imported anywhere outside their own file:

| Symbol | File | Notes |
|---|---|---|
| `DeployResult` | `src/sim/deploy.ts` | Union type for deploy return — used implicitly but not re-imported |
| `PetTuple` | `src/types/pet.ts` | Internal tuple type; used only in `src/types/pet.ts` itself |
| `PLANNING_TIMEOUT_EARLY_SECONDS` | `src/config/balance.ts` | Planning timer constants — not yet wired to online timer logic |
| `PLANNING_TIMEOUT_LATE_SECONDS` | `src/config/balance.ts` | Same as above |

**Note**: `PLANNING_TIMEOUT_*` constants are the most actionable item here — they're defined but the online planning-phase countdown timer hasn't been implemented yet. These constants should be wired in after Supabase is live and online planning phase is tested end-to-end.

---

## Summary

| Category | Count | Severity |
|---|---|---|
| TODO/FIXME/XXX | 0 | — |
| TS type errors | 0 | — |
| Build errors | 0 | — |
| Build warnings (Rollup) | 3 | Low (cosmetic) |
| Debug console.log | 0 | — |
| Unused exports | 4 | Low |
| Unimplemented constants | 2 | Medium (planning timeout not wired) |
