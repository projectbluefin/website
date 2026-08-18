# Licensing and provenance

Third-party asset rights for Wolves. Loaded from the `wolves-content` skill before any asset from an outside source enters the show.

Back to [`../SKILL.md`](../SKILL.md).

## Bungie fan-content guidelines are not an open asset license

Bungie's official policy supports some non-commercial fan-created media using
game imagery, but explicitly says the guidelines are not permission to use
Bungie intellectual property:

<https://help.bungie.net/hc/en-us/articles/360049201911-Intellectual-Property-and-Trademarks>

Do not describe Destiny press-kit downloads, screenshots, or concept art as
freely licensed. Bungie retains rights in game scenery and related assets, may
remove fan work, treats donation or monetary-support solicitation as
commercial, and requires permission for commercial use.

When the owner approves the fan-content-guidelines basis for a non-commercial
Wolves use:

- use an official Bungie source or the credited Bungie artist's primary
  portfolio;
- record the exact upstream URL, artist, work title, retrieval date, and policy
  URL in the owning source ledger;
- keep the source geometry and visible content; do not redraw, recolor, upscale,
  remove signatures, or substitute generated approximations;
- credit Bungie and the named artist without implying endorsement;
- stop if the presentation becomes monetized, donation-supported, merchandise,
  or otherwise commercial until written Bungie permission is recorded.

A download button proves availability, not redistribution rights. If an asset
has no authoritative source or the proposed use falls outside the approved
non-commercial fan-content scope, do not add it.

ArtStation asset URLs follow
`https://cdn{a|b}.artstation.com/p/assets/images/images/<id>/{large|4k}/<filename>?<timestamp>`.
The `/4k/` rendition is the largest publicly retrievable size (2200px wide, at
least for the Director's Cut's Mark Goldsworthy concept paintings) and is
preferred over `/large/` (1920px) when the brief calls for the largest
approved source; `cdna`/`cdnb` serve identical bytes for the same asset id, so
keep whichever subdomain the existing record already used to minimize diff.

Not every upstream URL in the artwork ledger is a stable download endpoint.
E1's `upstreamAssetUrl` is a signed, expiring gamespress.com CDN link
(`?otf=y&lightbox=y&sky=...` query parameters). It is retrieval evidence for
where and when the asset was obtained, not a link a future agent can fetch
again once it expires; the ledger's inline comment on that record says so.
Don't "fix" it by swapping in a different, unverified URL just to make it look
durable — record the instability instead.

## Record a provenance gap; never fill it with a plausible URL

When art comes from a local collection with no recoverable source page, the
honest record is the gap. Inventing a plausible upstream URL satisfies the
URL-shape tests and lies in the ledger — the next agent reads a fabricated
link as verified evidence and builds on it.

The artwork registry models this directly: `provenance: 'owner-supplied-local'`
with no `upstreamAssetUrl`, plus an `artistCreditState` of
`'filename-asserted'` when the supplied filename names an artist or
`'unattributed'` when it does not. A claim is exactly as strong as its
evidence; a record that cannot name its source says so.
