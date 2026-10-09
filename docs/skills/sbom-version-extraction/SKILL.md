---
name: sbom-version-extraction
description: Use when editing scripts/lib/spdx-version-extractor.js, scripts/lib/oci-sbom.js, scripts/lib/image-sbom-registry.js, scripts/lib/image-version-audit.js, scripts/lib/verified-image-sbom.js, scripts/lib/sbom-issue-report.js, scripts/lib/sbom-issue-sync.js, scripts/lib/bluefin-version-projection.js, scripts/lib/dakota-version-projection.js, scripts/update-dakota-versions.js, scripts/update-stream-versions.js, scripts/update-image-versions.js, .github/workflows/update-content.yml, or their tests.
---

# SBOM version extraction

## Overview

Version data for Dakota (`public/dakota-versions.json`) and Bluefin
(`public/stream-versions.yml`) is derived exclusively from SPDX SBOMs attached
to published GHCR images. Editing the scripts that drive this pipeline requires
understanding how BuildStream SBOMs differ from Syft SBOMs and how ambiguity is
handled.

**Prohibited sources.** Do not reinstate parsing of `.bst` source refs or GitHub
file content. Those sources describe the next build, not the image users are
running. Any future PR restoring those imports should be rejected.

## When to Use

Use when editing any of these files:

- `scripts/lib/spdx-version-extractor.js`
- `scripts/lib/image-sbom-registry.js`
- `scripts/lib/bluefin-version-projection.js`
- `scripts/lib/oci-sbom.js`
- `scripts/update-dakota-versions.js`
- `scripts/update-stream-versions.js`
- `scripts/tests/spdx-version-extractor.test.ts`
- `scripts/tests/image-sbom-registry.test.ts`
- `scripts/tests/fixtures/bluefin-stable-catalogers.syft.json`
- `scripts/tests/bluefin-version-projection.test.ts`
- `scripts/tests/update-dakota-versions.test.ts`
- `scripts/tests/update-stream-versions.test.ts`
- `scripts/tests/fixtures/dakota-linux-elements.spdx.json`

## When NOT to Use

Do not use for editing `public/dakota-versions.json` directly — that file is
generated. Do not use for Wolves version data; that lives in
`docs/reference/wolves-runtime.md`.

## Core Process

1. Read the failure policy at the top of `update-image-versions.js`.
2. Run `npx vitest run scripts/tests/spdx-version-extractor.test.ts scripts/tests/update-image-versions.test.ts scripts/tests/update-dakota-versions.test.ts scripts/tests/bluefin-version-projection.test.ts scripts/tests/update-stream-versions.test.ts` before and after changes.
3. Commit the implementation file before or in the same commit as any test
   that imports it.
4. Update this skill when you discover a new correctness rule.



| File | Role |
|---|---|
| `scripts/lib/spdx-version-extractor.js` | Core extraction: `normalizeVersion`, `packageElement`, `extractMappedVersions` |
| `scripts/lib/bluefin-version-projection.js` | Bluefin projection: `projectBluefinStreams`, `normalizeUserVersion` |
| `scripts/lib/oci-sbom.js` | OCI layer: `pullImageSbom`, `compareVersions`, `spdxPackageVersion` |
| `scripts/update-image-versions.js` | Unified verifier, projection guard, audit writer, and atomic output promotion |
| `scripts/update-dakota-versions.js` | Compatibility alias that delegates to the unified updater |
| `scripts/update-stream-versions.js` | Compatibility alias that delegates to the unified updater |
| `scripts/tests/spdx-version-extractor.test.ts` | Extractor unit tests |
| `scripts/tests/bluefin-version-projection.test.ts` | Projection unit tests |
| `scripts/tests/update-dakota-versions.test.ts` | Dakota updater integration tests |
| `scripts/tests/update-stream-versions.test.ts` | Bluefin updater tests |
| `scripts/tests/fixtures/dakota-linux-elements.spdx.json` | BuildStream SPDX fixture (historical/unit tests) |
| `scripts/tests/fixtures/dakota-stable-linux-elements.spdx.json` | Live BuildStream SPDX fixture (`core/linux-fdsdk.bst` pin) |

## Critical correctness rules

### Ambiguity: never silently pick the highest version

BuildStream SBOMs list a package once per build element. The same package name
(`linux`) can carry multiple distinct versions from different elements
(`bootstrap/linux-headers.bst` = 6.12.40, `components/linux.bst` = 7.0.7).

`spdxPackageVersion(sbom, name)` **must return `undefined` when the name-only
lookup is ambiguous** (multiple distinct accepted versions). The function must
not fall back to picking the numerically highest value — that silently selects
headers over the kernel, or a build tool over a runtime package.

Callers that need element-pinned lookup must use `extractMappedVersions` with
an `element` selector.

### `compareVersions` must use `parseInt`, not `Number`

`Number('8-ogc1')` is `NaN`. `parseInt('8-ogc1', 10)` is `8`. The difference
matters because BuildStream kernel versions carry suffixes like `-ogc1`, `-rc2`,
and RPM release strings like `-1`. Passing such a version to any function that
uses `Number()` on dot-split segments will produce `NaN` comparisons, corrupting
sort order.

`compareVersions` in `oci-sbom.js` uses `parseInt(seg, 10)` on every segment.

### Hash rejection

`normalizeVersion` rejects any value matching `/^[0-9a-f]{40,}$/i` — that is,
strings of 40 or more lowercase or uppercase hex characters with no dots.
SHA-1 (40 hex), SHA-256 (64 hex), and similar commit hashes all match.

**Test fixtures must use a provably valid hash.** Use the SHA-256 of the empty
string to make the intent unambiguous:

```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

Verify with: `echo -n '' | sha256sum`

### Commit order: implementation before tests

When `scripts/update-dakota-versions.js` is dirty (uncommitted), tests that
import from it pass locally but fail in a clean worktree. Always commit the
implementation in the same commit as the tests that import it, or in a prior
commit. Never commit a test file before the module it imports.

### Element pins follow the published SBOM, not the last known name

`missing-required` for a shipping component means the `element` pin drifted
(dakota#1687 moved mesa to `extensions/mesa/mesa-extra.bst`; `mesa.bst` still
exists). Re-pin against live SPDX, never weaken `required`; update pin+fixture+test.

### Bluefin projection-layer normalisation

User-facing RPM versions in `stream-versions.yml` are normalised by
`normalizeUserVersion` in `bluefin-version-projection.js`, **not** in the shared
extractor. The shared extractor preserves raw SPDX evidence unchanged.

Rules:
- Strip leading numeric epoch (`3:610.57.04-1.fc44` → `610.57.04-1`)
- Strip trailing `.fcNN` / `.elNN` suffix (`7.1.6-201.fc44` → `7.1.6-201`)
- Preserve RPM release segment (`-1`, `-201`)

### Syft OSTree package records

Syft's ELF cataloger can report the same package name from both the current
rootfs and older objects retained in an OSTree repository, producing distinct
versions that cannot be safely resolved by choosing the highest one. For
Bluefin Mesa, use the installed `mesa-dri-drivers` record from
`rpm-db-cataloger` as the authoritative representative of the Mesa source
build; do not select between the ambiguous `mesa` ELF records.

Bluefin `systemd` carries the identical failure mode: the ELF cataloger reports
both the live rootfs binary and an older object retained in the OSTree
repository under the same `systemd` name at distinct versions. Pin it with
`{ name: 'systemd', type: 'rpm', foundBy: 'rpm-db-cataloger', required: false }`,
the same selector shape as `podman`, rather than an `element` pin (Bluefin is
not a BuildStream image, so no `.bst` element exists to pin).

### `versionInfo` takes precedence over `version`

`extractMappedVersions` reads `pkg.versionInfo ?? pkg.version`. Syft SBOMs use
`version`; SPDX uses `versionInfo`. The fallback is necessary for Syft
compatibility. Do not normalise or strip raw values in the shared extractor.

### `checkedAt` in stream-versions.yml

`stream-versions.yml` must include a top-level `checkedAt` ISO timestamp.
The homepage Classic card consumes its `stable` package rows only when
`stable.status` is `verified`. The unified updater projects and promotes
Bluefin and Dakota outputs atomically.

## Fixture structure

`dakota-linux-elements.spdx.json` is a minimal BuildStream SPDX that exercises:

- `linux` 6.12.40 from `bootstrap/linux-headers.bst` (headers, not kernel)
- `linux` 7.0.7 from `components/linux.bst` (historical kernel element)
- `linux` `e3b0c44298...` from `patches/linux-some-fix.bst` (hash → rejected)
- `NVIDIA-Linux-x86` 595.71.05 from `components/nvidia.bst` (unambiguous)
- `linux` 7.1.8-ogc1 from `core/linux-ogc.bst` (kernel with suffix)

`dakota-stable-linux-elements.spdx.json` pins the live Dakota `:stable` kernel element:
- `linux` 7.2.6 from `core/linux-fdsdk.bst` (the booted kernel)
- `linux` 6.18.41 from `freedesktop-sdk.bst:bootstrap/linux-headers.bst` (headers)
- `linux` 7.2.2 from `freedesktop-sdk.bst:components/_private/bpf.bst` (bpf)

In current Dakota `:stable` BuildStream builds, the booted kernel lives at
`core/linux-fdsdk.bst`. The legacy `freedesktop-sdk.bst:components/linux.bst`
element is no longer present.

A name-only `linux` mapping must be ambiguous (three distinct accepted versions).
Element-pinned mappings must resolve unambiguously to their single version.

## Running tests

```bash
npx vitest run scripts/tests/spdx-version-extractor.test.ts scripts/tests/update-dakota-versions.test.ts
```

Expected: all tests pass, no NaN warnings.

## Verification

```bash
# Check compareVersions handles kernel suffixes:
node -e "import('./scripts/lib/oci-sbom.js').then(m => console.log(m.compareVersions('7.1.8-ogc1','7.1.7')))"
# Expected: a positive number (not NaN)

# Verify spdxPackageVersion returns undefined on ambiguity:
node -e "
import('./scripts/lib/oci-sbom.js').then(({spdxPackageVersion}) => {
  const sbom = { packages: [
    { name: 'x', versionInfo: '1.0' },
    { name: 'x', versionInfo: '2.0' },
  ]}
  console.log(spdxPackageVersion(sbom, 'x'))  // must print: undefined
})"

# Verify fixture hash is valid SHA-256:
echo -n '' | sha256sum
# Expected: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  -

# Verify the Bluefin Mesa selector against the live-evidence fixture:
npx vitest run scripts/tests/image-sbom-registry.test.ts
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The tests pass so highest-version fallback is fine." | A fallback silently hides element ambiguity. Return undefined; let the caller decide. |
| "I'll update the fixture hash later." | Use `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` from the start; it is verifiable. |
| "The implementation is only dirty, not missing." | Tests that import a dirty file fail in a clean worktree. Commit together. |
| "The registry listed the SBOM next to a signed image, so it is the publisher's." | `oras discover` is unsigned. The sigstore-bundle referrer beside the SPDX one is the image's provenance, subject to the image digest — it says nothing about the SBOM artifact. Only `cosign verify <repository>@<sbomDigest>` proves authorship. |
| "Signature verification will break the site, so skip it." | The audit surfaces the gap (`missing-sbom-signature` issue) instead of publishing unproven claims. Fix the publisher; do not re-disable the check. |

## Red Flags

- `spdxPackageVersion` returns a version string when the package appears under
  multiple build elements with different versions.
- `compareVersions('7.1.8-ogc1', '7.1.7')` returns `NaN` or throws.
- A fixture hash is shorter than 64 hex characters.
- `scripts/update-dakota-versions.js` is not committed but
  `update-dakota-versions.test.ts` is.

## Orchestrator (`image-version-audit.js` / `update-image-versions.js`)

Task 4 adds a registry-wide orchestrator on top of the extractor.

**Failure policy (enforced by tests):**
- `pendingSbom` records are NOT skipped — they are attempted like all others.
- `EvidenceError` from any image (required or optional) → `status: "unavailable"` in the audit with `required`, `errorCode`, and `error` fields.
- `ToolingError` or any other non-`EvidenceError` → abort, no file written.
- Missing or ambiguous *required* package → `status: "unavailable"` with
  `missingRequired` / `ambiguousRequired` and errorCode `missing-required` /
  `ambiguous-required`. Missing wins when both apply.
- Missing or ambiguous *optional* package → `status: "degraded"`, verified
  values kept, unresolved fields omitted, errorCode `ambiguous-optional` /
  `missing-optional`. Ambiguous wins when both apply.
- `pendingSbom: true` or an empty `packages` map → `status: "unavailable"`,
  errorCode `pending-mapping`, digests retained — even when the image now
  publishes an SPDX referrer.
- Every entry carries `fields` (the mapped field names) so the field-loss guard
  can tell an explained removal from a broken verifier.
- Unavailable entries never carry `values`. A projection cannot leak what the
  audit does not hold.
- Every audit entry carries `pending` (`record.pendingSbom === true`), recording
  whether the record is awaiting initial SBOM publication.

**Status vocabulary is audit-only.** `public/stream-versions.yml` and
`public/dakota-versions.json` still use `verified` / `unavailable`.
The Classic and Dakota cards in `SectionPicker.vue`, and
`DakotaVersionCard.vue`, render package rows only when their public projection
is `verified`. LTS stays Coming Soon until an explicit release change.
Degradation is expressed by the *absence* of unresolved fields, plus the audit
record and its issue. Do not emit `degraded` into a public file without changing
those consumers first — that is a design change, not a content change.

**`productStatus` logic:**
- All verified → `ok`
- Any *required* unavailable → `unavailable`
- Otherwise (degraded or optional unavailable) → `degraded`

**`--check-only` exits nonzero when ANY audit entry is unavailable**, including optional pending evidence. Normal mode exits zero for EvidenceErrors so deployment proceeds and issues alert. Exit code `2` is reserved for a `ToolingError`: nothing was written.

**Atomic writes:** `writeOutputsAtomically` validates all outputs first, then writes to a `mkdtempSync` directory **inside `destinationRoot`** (not `os.tmpdir()`) and renames each file into place. Staging under the same filesystem as the destination guarantees `renameSync` cannot fail with `EXDEV`. If validation throws, no file is written; cleanup removes only the staging subdirectory, never `destinationRoot`.

**Dependency injection:** `verifyRegistry` accepts `collectVerifiedImageSbom`, `now`, `run`, and `fs` so tests can run without network or disk I/O.

**`product` is required on every audit image entry.** `verifyRegistry` copies `record.product` onto each output entry (verified and unavailable). `productStatus` throws an explicit error if any entry lacks a `product` field — there is no silent `"unknown"` fallback. The composition `productStatus(await verifyRegistry(records, deps))` must work without caller mutation.

**There is one write path.** `update-dakota-versions.js` and
`update-stream-versions.js` are compatibility aliases that call
`updateImageVersions()`. Product-only wrappers must not verify and write their
own files: that bypasses the persisted audit, explained-field-loss checks, and
atomic multi-output promotion.



## Clearing `pendingSbom` (resolving a `pending-mapping` issue)

`pending-mapping` is the only audit code whose fix is a registry edit rather
than a code fix. It means the publisher started attaching an SPDX referrer and
a human still has to confirm which SPDX package names carry the fields we
publish. Do not clear the flag on the strength of the issue body alone — the
body proves an SBOM exists, not that the mapping resolves.

Review it against the real document. `oras` and `cosign` are usually absent
from an agent sandbox, but the issue body carries the SBOM digest and GHCR
serves it to an anonymous token, so the SPDX is directly fetchable:

```bash
TOKEN=$(curl -sS "https://ghcr.io/token?scope=repository:<owner>/<repo>:pull&service=ghcr.io" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
# The issue's SBOM digest is the referrer MANIFEST; its single layer is the SPDX.
curl -sS -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
  "https://ghcr.io/v2/<owner>/<repo>/manifests/<sbom-digest>"
curl -sSL -H "Authorization: Bearer $TOKEN" \
  "https://ghcr.io/v2/<owner>/<repo>/blobs/<layer-digest>" \
  -o /var/tmp/website-agent/<image>.spdx.json
```

Confirm the downloaded blob's `sha256sum` matches the layer digest, then run the
registry's own mapping through `extractMappedVersions` against it and require
`ambiguous: []` and `missingRequired: []` before editing anything.

Then, in the same commit:

1. Delete `pendingSbom: true` and replace the stale "no SPDX referrer yet"
   comment with what the review found — the digests, the resolving element, and
   why no selector was needed (or which one was).
2. Add a trimmed fixture under `scripts/tests/fixtures/` carrying the resolving
   package **and its near-miss neighbours** from the real document, and assert
   the registry mapping resolves against it. A fixture holding only the winning
   package proves nothing about ambiguity.
3. Update the registry test that asserted the record was pending. Leaving it is
   a hard failure, not a warning.

Provenance is already proven when a `pending-mapping` issue exists:
`verifyRegistry` reaches that branch only after `collectVerifiedImageSbom`
returned, which runs `cosign verify-attestation` (the image) and
`verifySbomSignature` (the SPDX referrer itself) first. Clearing the flag
therefore cannot surface a hidden `missing-provenance` or
`missing-sbom-signature`. What `pending-mapping` does **not** cover is the
package mapping: that review is human work on the real document.

**Pin an element only when the name is actually ambiguous.** The registry's own
convention: Dakota pins `kernel`, `mesa`, and `systemd` because BuildStream
reports those names under several elements; `gnome`, `podman`, `pipewire`,
`flatpak`, and `bootc` stay name-only. A gratuitous pin converts an upstream
element rename into `missing-required` — a removed version claim and an alert —
for no disambiguation benefit. Example: `dakota-nvidia` publishes
`NVIDIA-Linux-x86` exactly once (`bluefin-nvidia/nvidia-drivers.bst`); the
similarly named `nvidia-drivers`, `nvidia-container-toolkit`,
`nvidia-vaapi-driver`, and `nvidia-device-nodes` packages are *different names*
and cannot collide, so that mapping stays name-only.

Note `nvidia-device-nodes` carries a versionInfo of
`<64 hex>/102`. It is not rejected by the hash guard — the guard only matches a
bare 40+ hex string — but it fails the accepted-version pattern, so it lands in
`rejected` rather than `values`. Only a mapping that names it would ever see it.

## Evidence failure vs tooling failure

`scripts/lib/verified-image-sbom.js` exports two error types and the difference
decides whether the website loses a version claim:

| Type | Means | Effect |
|---|---|---|
| `EvidenceError` | The publisher did not publish usable evidence | Recorded in the audit, field/product sanitized out, issue opened |
| `ToolingError` | We could not look | Aborts the run before any output, cache, or deploy |

`classifyToolFailure(err, tool)` runs first on every child-process failure and
returns a `ToolingError` for:

- `tool-missing` — spawn `ENOENT` (oras/cosign absent from PATH)
- `tool-timeout` — `ETIMEDOUT`, a killed process, or "context deadline exceeded"
- `registry-unavailable` — 429/500/502/503/504, `TOOMANYREQUESTS`
- `transport` — `ECONNRESET`/`ECONNREFUSED`/`EAI_AGAIN`, "no such host",
  "dial tcp", "tls: handshake failure", "certificate signed by unknown authority"
- `tool-io` — local `EACCES`/`EIO`/`ENOSPC`/`EMFILE`
- `malformed-output` — `oras discover` returned unparseable JSON
- `tool-failure` — anything unrecognised. **Unknown failures block.** We cannot
  tell "absent" from "unreachable", and blocking is the only safe default.

Only these stay `EvidenceError`:

- `image-not-found` — `NAME_UNKNOWN` / `MANIFEST_UNKNOWN` / "manifest unknown" / 404
- `missing-sbom`, `ambiguous-sbom` — referrer count is not exactly one
- `missing-provenance` — cosign found no matching attestation
- `invalid-provenance` — cosign rejected the identity (wrong publisher)
- `invalid-sbom-signature` — the SPDX referrer's signature exists but fails the
  publisher identity policy (wrong signer, bad certificate, broken bundle)
- `invalid-sbom` — the discovered SBOM artifact is absent or corrupt

Note the deliberate asymmetry in `pullSpdxReferrer`: a *network* failure while
pulling blocks, but a discovered artifact that is missing or unparseable is an
evidence failure, because the publisher attached a referrer it cannot serve.

`collectVerifiedImageSbom` runs three proofs, in order: resolve the digest,
verify the image's provenance attestation (`cosign verify-attestation`), then —
before a single byte of the referrer is pulled — verify the SPDX referrer
artifact's own signature (`cosign verify` against `<repository>@<sbomDigest>`,
`verifySbomSignature`). The referrer digest comes from `oras discover`, which
is an **unsigned registry listing**: any writer to the repository can attach a
referrer, and the provenance check binds the image digest only. The signature
check holds the artifact we are about to read to the same
`certificateIdentityRegexp` / `certificateOidcIssuer` policy as the image.

See [`references/publisher-signing.md`](references/publisher-signing.md) for details on publisher signing and warn-only verification.
Do not widen the transport pattern to bare `certificate` or `x509`: cosign
reports identity failures with those words, and misclassifying one as transport
would turn a wrong-publisher signature into a silent retry.

## Explained field loss

`assertExplainedFieldLoss()` runs in `update-image-versions.js` before any
output is promoted. Every field present in the previous public file and absent
from the new one must be explained by the current audit:

- listed in `missingRequired`, `missingOptional`, `ambiguousRequired`, or
  `ambiguousOptional` for that product, or
- mapped by an image of that product whose status is `unavailable`, or
- part of a block that is now explicitly `status: unavailable` while the product
  has an unavailable image.

Anything else throws before promotion. The alias map handles projection-level
renames (`hwe` ← the HWE image's `kernel` field); `baseline` is passed via
`ignore` because it is static metadata, not SBOM evidence.

When the projection status lives outside the guarded field map — Dakota stores
`status` beside `packages`, not inside it — pass `nextStatus` explicitly.
Otherwise a correctly unavailable whole-product projection can be mistaken for
unexplained loss from an independently verified optional image.

## Image staleness: `checkedAt`, not image age

The design document lists "maximum acceptable age" as a registry field. It is
deliberately not implemented as an image-publication-age threshold, and adding
one would be wrong:

- What must be fresh is the **evidence**, and the daily run records that
  directly as `checkedAt` on every audit entry and every public file. A run
  older than a day is visible without inventing a number.
- Image publication age is **release cadence**, not staleness. A stable image
  that has not been rebuilt in six weeks because nothing changed is correct, not
  stale; failing it would remove accurate version data from the website and
  open an issue nobody can fix.
- Any threshold would be an invented constant with no upstream contract behind
  it, and the first long holiday freeze would turn it into noise everyone learns
  to ignore.

If upstream ever publishes a rebuild SLA, that SLA — not a guess — becomes the
threshold.

## github-script must not import relative paths

`actions/github-script` compiles the YAML `script` body inside its own bundled
module under `_actions/`, so `await import('./scripts/lib/x.js')` resolves
against the action, not the checkout, and throws `ERR_MODULE_NOT_FOUND` at
runtime while every YAML assertion passes.

Two rules:

1. Resolve from the working directory:
   `pathToFileURL(path.join(process.cwd(), 'scripts', 'lib', 'x.js')).href`.
2. Keep the body to a loader. The logic lives in `scripts/lib/sbom-issue-sync.js`
   so it can be tested directly.

`scripts/tests/workflow-sbom-policy.test.ts` executes the real script bodies
through `scripts/tests/fixtures/github-script-runner.mjs`, which reproduces the
action's referrer semantics (compiled in a module away from the repo root, run
with the repo root as cwd). It carries a negative-control test proving a
relative specifier still fails there.

## Issue alerts

- Title is `[SBOM verification] <product>: <errorCode>` — the **exact** audit
  code, so two different failures never share an issue.
- `degraded` images alert too; a silently omitted optional field is the loss
  this pipeline exists to surface.
- Bodies carry the workflow run URL and the per-image last successful
  verification, or the literal `none recorded`.
- `annotateLastSuccessful()` copies the previous audit's `checkedAt` onto a
  newly failing entry and carries an existing `lastSuccessfulAt` through every
  consecutive failed run. This is why `update-content.yml` restores the
  live-data cache *before* verification, using the exact save path list in the
  same order.
- Both `listForRepo` calls use `github.paginate`. Deduplication that only reads
  the first 100 open issues silently starts opening duplicates.
- Pending records awaiting initial SBOM publication (`pending && errorCode === 'missing-sbom'`)
  do NOT alert: the absence of an SBOM on an image marked `pendingSbom: true` is
  expected, not a regression. When an SBOM is published, the image alerts with
  `pending-mapping` so maintainers can review package mappings. Genuine
  `missing-sbom` on active/mapped images continues to alert.
- The generic run-failure issue is deduplicated by exact title too, via
  `syncWorkflowFailureIssue()`.

## Live-data cache parity and catalogue preservation

`actions/cache` derives cache versions from the exact path list, so `update-content.yml`
and `deploy.yml` must use the identical path list. Because `actions/cache/restore`
unpacks the directory, it overwrites the tracked `public/experiences/catalogue.json`.
Both workflows immediately restore the tracked catalogue via
`git checkout HEAD -- public/experiences/catalogue.json` after cache restoration.
`refreshMetadata()` only overwrites an on-disk entry with its git HEAD copy when
running in CI (`preferGitEntries`), preserving local scrape edits outside CI.
