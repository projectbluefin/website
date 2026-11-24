# Reading CI signals

## A cache path list is part of the cache key

`actions/cache` derives the cache *version* from the `path` list, not just from
`key`. A restore step whose path list differs from the save step's — in content
**or in order** — can never match, and `restore-keys` is version-scoped too, so
the fallback does not rescue it.

With `fail-on-cache-miss: false` the miss is silent. The build proceeds with
whatever is committed, and the producing job keeps reporting success while
delivering nothing.

Adding a single path to the save step in `update-content.yml` broke every
live-data feed exactly this way, including two that had nothing to do with the
change. Nothing in CI went red: the workflow that breaks is not the workflow
that runs on the pull request.

`website-live-data-` has one producer (`update-content.yml`) and two consumers
(`deploy.yml`, `preview.yml`). All three lists must stay byte-identical;
`scripts/tests/workflow-cache-parity.test.ts` enforces it.

When touching any cached path, enumerate every workflow that restores that key
before editing the one that saves it. Grep the key, not the filename.


## A red integration branch is not automatically your fault

Before debugging a CI failure on a branch that merges other people's work,
check whether `main` is green at the same code. `gh run list --branch main
--workflow CI --limit 3` answers it in one call.

An integration of a devcontainer and two test files failed
`wolves-movie-flow` on an assertion about a slide handoff at 48.4 seconds — in
code the branch did not touch. `main` was green at the identical runtime, and a
re-run with no change passed. It was a flake, not a regression.

The cause is worth knowing, because the harness has more assertions shaped like
this one: slide swaps are gated on the incoming image decoding, and `seekStage`
settles for a fixed 250 ms. Any assertion that seeks to a boundary and then
immediately reads the active layer is racing a decode. On a cold runner the
decode loses.

The fix is to wait for the state you expect and then assert, rather than
asserting on a timer — a genuine regression still fails, it just takes the
timeout to get there. When adding a boundary assertion to
`tests/wolves-movie-flow.mjs`, wait for the transition rather than trusting the
settle time.

## "Found 0 artifact(s)" in the Pages deploy is a listing lag

`actions/deploy-pages` asks the Actions API for the `github-pages` artifact
well under a second after `upload-pages-artifact` reports it finalized. That
listing can lag, and the deploy then fails with "Found 0 artifact(s)" / "No
artifacts named "github-pages" were found" although the upload succeeded
(#1058: runs 44902561882 and 45303513624). The build and the action pins are
not the cause; the same pins deployed fine on the runs either side.

`deploy.yml` therefore runs the deploy step with `continue-on-error`, waits
30 seconds, and retries once. The environment URL reads from whichever attempt
ran. A real deploy failure fails both attempts and still turns the job red, so
do not add more retries to hide one. If this error ever survives the retry,
check githubstatus.com before touching the workflow.

---

Procedure and gate: [`../SKILL.md`](../SKILL.md).
