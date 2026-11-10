# StarForge Security Review

**Purpose:** Pre-deployment security audit for a hosted single-player demo (no backend, localStorage only).  
**Reviewer:** Claude Code (multi-agent, automated)  
**Date:** 2026-04-20  
**Repo:** https://github.com/Donsig/StarForge  
**Stack:** Vite + React 19 + TypeScript (strict), no server-side code  

---

## Status

| Pass | Focus | Status |
|------|-------|--------|
| P0 | npm audit (dependencies) | ✅ Complete |
| P1 | XSS / DOM injection vectors | ✅ Complete — PASS |
| P2 | AdminPanel & debug surface | ✅ Complete — FAIL |
| P3 | Input validation & user-controlled data | ✅ Complete — PASS |
| P4 | State persistence (localStorage) | ✅ Complete — PASS |
| P5 | Build config / CSP / hosting hardening | ✅ Complete — NEEDS_REVIEW |
| P6 | Synthesis & recommendations | ✅ Complete — NEEDS_REVIEW |

---

## P0 — npm audit

8 vulnerabilities found (2 moderate, 6 high). All fixable via `npm audit fix`.

| Package | Severity | Issue |
|---------|----------|-------|
| `vite` 7.0.0–7.3.1 | **HIGH** | Path traversal in optimized deps `.map` handling; `server.fs.deny` bypass; arbitrary file read via dev server WebSocket |
| `rollup` 4.0.0–4.58.0 | **HIGH** | Arbitrary file write via path traversal |
| `undici` 7.0.0–7.23.0 | **HIGH** | WebSocket parser overflow crash; HTTP request smuggling; CRLF injection; memory DoS |
| `flatted` ≤3.4.1 | **HIGH** | Unbounded recursion DoS in parse(); prototype pollution via parse() |
| `minimatch` ≤3.1.3 / 9.0.0–9.0.6 | **HIGH** | Multiple ReDoS via wildcard patterns |
| `picomatch` 4.0.0–4.0.3 | **HIGH** | Method injection in POSIX classes; ReDoS via extglob |
| `ajv` <6.14.0 | moderate | ReDoS with `$data` option |
| `brace-expansion` <1.1.13 / 2.0.0–2.0.3 | moderate | Zero-step sequence → process hang + memory exhaustion |

> **Note:** Most of these are in `devDependencies` (Vite, Rollup, ESLint toolchain) and **are NOT bundled into the production build**. The critical ones for a hosted deployment are Vite (dev server — don't expose it publicly) and Rollup (build-time only). Still, run `npm audit fix` before shipping.

---

## P1 — XSS / DOM Injection

### Summary
Zero XSS or DOM injection vulnerabilities found. All user-controlled data is sanitized before storage. All DOM rendering uses safe React JSX patterns.

### Findings
| ID | Severity | File | Line | Notes |
|----|----------|------|------|-------|
| — | INFO | `hooks/useGameEngine.ts` | ~573 | Planet rename trimmed + capped at 30 chars before state write |
| — | INFO | Multiple | — | CSS property names are all static literals — safe |
| — | INFO | `data/assets.ts` | — | Asset URLs from whitelisted enum lookup, no user input in URL construction |

**Checked and found clean:** React HTML injection APIs, dynamic code execution patterns, direct DOM write APIs, unsafe protocol hrefs, string-based timer callbacks.

### Verdict
**PASS**

---

## P2 — AdminPanel & Debug Surface

### Summary
**Critical for demo deployment.** The AdminPanel is fully accessible from the main navigation sidebar to every user — no environment check, no feature flag, no auth. Any visitor to the hosted demo can trivialize the entire game, inject resources, skip time, manipulate NPCs, and export raw game state.

### Findings
| ID | Severity | File | Line | Notes |
|----|----------|------|------|-------|
| A1 | **HIGH** | `NavSidebar.tsx` | ~87–94 | Admin button rendered unconditionally in main nav — every user sees it |
| A2 | **HIGH** | `App.tsx` | ~53–54 | `case 'admin'` renders AdminPanel with no permission check |
| A3 | **HIGH** | `AdminPanel.tsx` | ~369–457 | Resource Tools: arbitrary resource injection to any planet, bypasses storage logic |
| A4 | **HIGH** | `AdminPanel.tsx` | ~460–694 | Empire Editor: set any building/research/ship/defence to any level, skips all prereqs and build times |
| A5 | **HIGH** | `AdminPanel.tsx` | ~697–887 | Planet Manipulation: instant colonisation, NPC conversion, arbitrary NPC creation |
| A6 | **HIGH** | `AdminPanel.tsx` | ~889–1171 | NPC Editor: full control over NPC tier/specialty/fleet/defences/raid history |
| A7 | **HIGH** | `AdminPanel.tsx` | ~1172–1272 | Instant Combat: simulate combat with arbitrary ships, preview loot before committing |
| A8 | **HIGH** | `AdminPanel.tsx` | ~1273–1334 | Time Controls: skip days/weeks of game time instantly |
| A9 | **HIGH** | `AdminPanel.tsx` | ~1336–1425 | Debug tab: exports entire raw `GameState` as JSON — reveals all hidden NPC state |
| A10 | MEDIUM | `AdminPanel.tsx` | ~1386–1418 | Galaxy regen with custom seed — deterministic farming of favorable spawns |
| A11 | MEDIUM | `AdminPanel.tsx` | ~1427–1460 | God Mode + 100× game speed slider — removes all time gates |
| A12 | INFO | `GameContext.tsx` | ~134–199 | All 40+ `admin*` functions part of standard context — no separation |

### Verdict
**FAIL — must fix before public deployment**

Fix: gate AdminPanel behind a Vite build-time env var (`VITE_ADMIN_ENABLED`). In production build set it to `false` — Vite will tree-shake the entire panel. Remove the nav button under the same condition.

---

## P3 — Input Validation & User-Controlled Data

### Summary
Numeric inputs are validated with `Number.parseInt()` + `Number.isInteger()` checks and `Math.min/max` clamping throughout. No URL parameter reads. No unsafe rendering. One minor inconsistency and one code smell found — neither exploitable.

### Findings
| ID | Severity | File | Line | Notes |
|----|----------|------|------|-------|
| P3-01 | LOW | `panels/GalaxyPanel.tsx` | ~481 | Bare `parseInt()` instead of `Number.parseInt()` — safe (radix 10 specified + clamped immediately after) |
| P3-02 | MEDIUM | `context/GameContext.tsx` | ~47–70 | `ensureContextPrototypeDefaults()` modifies `Object.prototype` with `defineProperty` — anti-pattern, not exploitable here, but should be replaced with null-coalescing or default params |
| P3-03 | INFO | `panels/AdminPanel.tsx` | ~52–70 | `parseIntOrZero()` / `parseOptionalInt()` helpers — correct NaN/Infinity guards |
| P3-04 | INFO | `panels/FleetPanel.tsx` | ~671–675 | Ship qty uses `Number.isFinite()` + clamp — correct |

### Verdict
**PASS**

---

## P4 — State Persistence (localStorage)

### Summary
`StateManager` is well hardened. The 7-day offline cap is enforced **before** any event processing (correct). `JSON.parse` failures fall back to `null` cleanly. Migration handles v1–v18 with explicit checks and no dynamic code execution. Unknown future versions skip migration safely.

### Findings
| ID | Severity | File | Line | Notes |
|----|----------|------|------|-------|
| P4-01 | LOW | `engine/StateManager.ts` | ~342 | `JSON.parse` wrapped in try/catch, returns null on failure — safe |
| P4-02 | LOW | `engine/StateManager.ts` | ~398 | `importSave()` validates `parsed.version` and `parsed.planets` exist before use — safe |
| P4-03 | INFO | `engine/StateManager.ts` | ~707–710 | 7-day cap via `Math.min(..., MAX_OFFLINE_SECONDS)` applied **before** processing — correct, prevents crafted `lastSaveTimestamp` abuse |
| P4-04 | INFO | `engine/StateManager.ts` | ~410–688 | `migrate()` — no loops, no dynamic code execution, all version branches explicit |

### Verdict
**PASS**

---

## P5 — Build Config / CSP / Hosting Hardening

### Summary
Strong TypeScript config and clean build pipeline, but no Content Security Policy is defined anywhere. Google Fonts is loaded from an external CDN without subresource integrity. The Vite dev server has `fs.strict: false` (permissive filesystem access — fine for dev, must not be exposed publicly). No `.env` files or secrets in the repo.

### Current State
- **TypeScript:** `strict: true` + `noUnusedLocals`, `noUnusedParameters`, `noUncheckedSideEffectImports`
- **Vite config:** React plugin only; dev server has `fs.strict: false`
- **index.html:** No CSP meta tag. One external resource: Google Fonts CSS (no integrity hash). One inline module script (Vite default entry — unavoidable without Vite plugin)
- **public/:** Only `.webp` image assets — no sensitive files
- **No `.env` files** in repo — good
- **Source maps:** Not explicitly disabled; Vite defaults to off in production builds — safe but not documented

### Findings
| ID | Severity | File | Notes |
|----|----------|------|-------|
| F-CSP | HIGH | `index.html` | No Content-Security-Policy defined. Must be set at hosting layer before deploy. |
| F-SRI | MEDIUM | `index.html` | Google Fonts loaded without `integrity` / SRI hash. Recommend self-hosting or Fontsource. |
| F-DEVFS | LOW | `vite.config.ts` | `fs.strict: false` — permissive dev server. Never expose dev server publicly. |
| F-SRCMAP | INFO | `vite.config.ts` | `build.sourcemap` not explicitly set. Vite defaults off in prod — add explicit `sourcemap: false` for clarity. |

### Required HTTP Security Headers (hosting server — Nginx / Caddy / Cloudflare)
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Verdict
**NEEDS_REVIEW** — Headers must be configured at hosting layer before deployment. No code injection risk, but missing hardening.

---

## P6 — Synthesis & Final Recommendations

**Review completed:** 2026-04-20 | **Passes:** P0–P5 (6 passes, 4 sub-agents)

### Overall Verdict: NEEDS_REVIEW

The application has no exploitable XSS, code injection, or data-exfiltration vulnerabilities. However, **one BLOCKING issue must be resolved before public deployment**: the AdminPanel is unconditionally rendered and navigable by every visitor, entirely breaking the game's progression integrity. Additionally, missing HTTP security headers and an unpatched dependency chain require action. Fix the three BLOCKING items and it is safe to host.

---

### Consolidated Findings Table

| ID | Severity | Pass | File | Description |
|----|----------|------|------|-------------|
| A1 | **HIGH** | P2 | `src/components/NavSidebar.tsx:87–94` | Admin nav button rendered unconditionally — every visitor can click it |
| A2 | **HIGH** | P2 | `src/App.tsx:53–54` | `case 'admin'` renders AdminPanel with no env guard |
| A3–A9 | **HIGH** | P2 | `src/panels/AdminPanel.tsx` | Full cheat surface: resource injection, instant builds, time skip, NPC editor, raw state export |
| F-CSP | **HIGH** | P5 | `index.html` | No Content-Security-Policy defined anywhere |
| F01 | **HIGH** | P0 | `node_modules/vite` | Path traversal + arbitrary file read in dev server (Vite 7.0–7.3.1) — `npm audit fix` |
| F02 | **HIGH** | P0 | `node_modules/rollup` | Build-time path traversal (Rollup 4.0–4.58.0) — `npm audit fix` |
| F03 | **HIGH** | P0 | `node_modules/flatted` | Prototype pollution + recursion DoS in parse() — build toolchain |
| F04 | **HIGH** | P0 | `node_modules/undici` | HTTP smuggling + WebSocket DoS — build toolchain |
| F05 | **HIGH** | P0 | `node_modules/minimatch`, `picomatch` | ReDoS in glob matching — dev toolchain |
| A10 | MEDIUM | P2 | `src/panels/AdminPanel.tsx:1386–1418` | Galaxy regen with custom seed — deterministic spawn farming |
| A11 | MEDIUM | P2 | `src/panels/AdminPanel.tsx:1427–1460` | God Mode + 100× speed slider |
| F-SRI | MEDIUM | P5 | `index.html:6` | Google Fonts loaded without SRI `integrity` hash |
| P3-02 | MEDIUM | P3 | `src/context/GameContext.tsx:47–70` | `Object.prototype` modification — anti-pattern |
| F06 | MEDIUM | P0 | `node_modules/ajv`, `brace-expansion` | ReDoS — dev toolchain |
| P3-01 | LOW | P3 | `src/panels/GalaxyPanel.tsx:481` | Bare `parseInt()` — safe but inconsistent |
| P4-01 | LOW | P4 | `src/engine/StateManager.ts:342` | `JSON.parse` try/catch + null fallback — correct |
| P4-02 | LOW | P4 | `src/engine/StateManager.ts:398` | `importSave()` validates fields before use — correct |
| F-DEVFS | LOW | P5 | `vite.config.ts:9–11` | `server.fs.strict: false` — fine for dev, never expose dev server |
| F-SRCMAP | INFO | P5 | `vite.config.ts` | `build.sourcemap` not explicit; Vite defaults off in prod |
| P4-03 | INFO | P4 | `src/engine/StateManager.ts:707–710` | 7-day offline cap applied before event processing — correct |

---

### Pre-Deployment Checklist

#### BLOCKING — Must fix before public hosting

**[BLOCKING-1] Gate AdminPanel behind a build-time env flag**

Create `.env.production`:
```
VITE_ADMIN_ENABLED=false
```

In `NavSidebar.tsx` — wrap the admin button:
```tsx
{import.meta.env.VITE_ADMIN_ENABLED === 'true' && (
  <>
    <hr className="nav-divider" />
    <button
      type="button"
      ref={activePanel === ADMIN_NAV_ITEM.id ? activeTabRef : null}
      className={`nav-button nav-button-admin ${activePanel === ADMIN_NAV_ITEM.id ? 'active' : ''}`}
      onClick={() => onNavigate(ADMIN_NAV_ITEM.id)}
    >
      <span>{ADMIN_NAV_ITEM.label}</span>
    </button>
  </>
)}
```

In `App.tsx` — guard the route:
```tsx
case 'admin':
  return import.meta.env.VITE_ADMIN_ENABLED === 'true'
    ? <AdminPanel />
    : <OverviewPanel onNavigate={onNavigate} />;
```

After `npm run build`, verify tree-shaking worked:
```bash
grep -r "adminSetResources\|godMode\|AdminPanel" dist/assets/
# Must return no matches
```

---

**[BLOCKING-2] Run `npm audit fix` before building**

```bash
npm audit fix
npm run build
npm test
```

Rollup and Vite vulnerabilities are in the build toolchain — a compromised build process can produce a compromised bundle.

---

**[BLOCKING-3] Set HTTP security headers at hosting layer**

See "Recommended HTTP Security Headers" section below.

---

#### RECOMMENDED

**[REC-1] Self-host fonts** — removes the external CDN dependency and simplifies CSP:
```bash
npm install @fontsource/orbitron @fontsource/space-grotesk @fontsource/jetbrains-mono
```
Import in `src/main.tsx` and remove the `<link>` from `index.html`.

**[REC-2] Explicit source map config in `vite.config.ts`:**
```ts
build: {
  sourcemap: false,
}
```

**[REC-3]** Replace `Object.prototype` modification in `GameContext.tsx:47–70` with null-coalescing at call sites.

**[REC-4]** `GalaxyPanel.tsx:481` — `parseInt` → `Number.parseInt`.

---

### Recommended HTTP Security Headers

**Nginx:**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

**Caddy:**
```
header {
    Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

**Cloudflare Pages** (`public/_headers`):
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

> If you self-host fonts (REC-1), simplify CSP to `style-src 'self'` and `font-src 'self'`.

---

### What Is NOT a Concern

The review confirmed the application is clean across its entire reactive surface. There are no XSS or DOM injection vulnerabilities — React's JSX renderer is used exclusively, with zero dynamic HTML injection patterns. User-supplied values (planet names, ship quantities, build targets) are trimmed, clamped, and validated before touching state. No URLs are constructed from user input; all asset URLs derive from whitelisted enum lookups in `src/data/assets.ts`.

`localStorage` parsing is safe: `StateManager` wraps every `JSON.parse` in try/catch with a null fallback, and the migration chain (v1–v18) uses only explicit version branches with no dynamic code execution. The 7-day offline cap is enforced before any event processing, preventing crafted `lastSaveTimestamp` values from triggering unbounded computation. There are no secrets, API keys, or credentials anywhere in the repository. The `public/` directory contains only `.webp` image assets.

---

## Findings

| ID | Severity | Pass | File | Description |
|----|----------|------|------|-------------|
| F01 | HIGH | P0 | `node_modules/vite` | Vite dev server path traversal + file read — never expose dev server publicly |
| F02 | HIGH | P0 | `node_modules/rollup` | Build-time path traversal — patch before building for production |
| F03 | HIGH | P0 | `node_modules/flatted` | Prototype pollution + recursion DoS in JSON parsing — used by build toolchain |
| F04 | HIGH | P0 | `node_modules/undici` | HTTP smuggling + WebSocket DoS — build toolchain dep |
| F05 | HIGH | P0 | `node_modules/minimatch`, `picomatch` | ReDoS in glob matching — dev toolchain |
| F06 | moderate | P0 | `node_modules/ajv`, `brace-expansion` | ReDoS — dev toolchain |

---

## Recommended Hosting Config

> Populated after P6.
