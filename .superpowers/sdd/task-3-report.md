# Task 3 Report: Browser Authentication Composables

## Scope

Implemented browser-only Google Identity Services and Spotify authorization-code PKCE composables. No playback, Wolves gate, component, layout, or provider-secret wiring was added. Google is used only for its credential gesture; it does not request YouTube or YouTube Music authorization.

Changed files:

- `src/composables/useGoogleIdentity.ts`
- `src/composables/useSpotifyAuth.ts`
- `src/vite-env.d.ts`
- `src/tests/useGoogleIdentity.test.ts`
- `src/tests/useSpotifyAuth.test.ts`

## TDD Evidence

1. Wrote the two focused test files before either production composable existed.
2. Ran `npx vitest run src/tests/useSpotifyAuth.test.ts src/tests/useGoogleIdentity.test.ts`.
3. Red result: both suites failed during Vite import analysis because `../composables/useSpotifyAuth` and `../composables/useGoogleIdentity` did not exist.
4. Added the minimal implementations and GIS ambient types.
5. Re-ran the focused command: 2 files, 9 tests passed.

The tests use injected browser, crypto, and network dependencies. They make no live Google or Spotify requests. Coverage includes missing provider configuration, GIS callback completion, PKCE redirect generation, state mismatch cleanup, consent denial/cancellation cleanup, code exchange cleanup, successful refresh, refresh failure, and explicit clear behavior.

## Verification

- `npx vitest run src/tests/useSpotifyAuth.test.ts src/tests/useGoogleIdentity.test.ts` passed: 2 files, 9 tests.
- `npx eslint src/composables/useGoogleIdentity.ts src/composables/useSpotifyAuth.ts src/tests/useGoogleIdentity.test.ts src/tests/useSpotifyAuth.test.ts src/vite-env.d.ts` passed.
- Focused TypeScript validation passed:
  `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --types vite/client --skipLibCheck src/vite-env.d.ts src/composables/useGoogleIdentity.ts src/composables/useSpotifyAuth.ts`.
- Whole-project `npm run typecheck` remains blocked by the pre-existing, user-owned edit in `src/data/wolves-intro-sequence.ts`: TS1002 unterminated string literal at line 361, followed by parser errors on lines 362-363. That file was not altered or staged.

## Self-review

- Spotify uses only `sessionStorage` for state, verifier, access token, refresh token, and expiry. `clear()` removes every key and no background refresh is scheduled.
- PKCE uses `crypto.getRandomValues`, SHA-256, and S256; callback state must exactly match before token exchange.
- Runtime Spotify scopes are exactly `streaming user-read-email user-read-private user-modify-playback-state`; no client secret is present.
- Missing Google or Spotify client IDs produce provider-specific configuration errors rather than silent failures.
- User-owned modifications in `public/dakota-versions.json` and `src/data/wolves-intro-sequence.ts` remain unstaged and unmodified by this task.
