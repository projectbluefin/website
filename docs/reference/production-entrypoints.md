# Production entry points

**Agents edit content. Agents never edit design.**

| Path | Entry | Visibility | Rule |
|---|---|---|---|
| `/` | `index.html` | Public | Main site entry. |
| `/wolves/` | `wolves/index.html` | Public | Wolves experience entry. |
| `/dakota/` | `dakota/index.html` | Unlisted and `noindex` | Do not promote. |
| `/knuckle/` | `knuckle/index.html` | Unlisted and `noindex` | Bluefin Server alias; do not promote. |
| `/bluespeed/` | `bluespeed/index.html` | Unlisted and `noindex` | Bluefin Server alias; do not promote. |
| `/server/` | `server/index.html` | Unlisted and `noindex` | Canonical Bluefin Server entry; do not promote. |

Read the entry file before documenting or changing a sub-application. Do not
copy metadata or entry scripts from another path.
