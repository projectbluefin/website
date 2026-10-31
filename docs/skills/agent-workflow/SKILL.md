---
name: agent-workflow
description: Use at session start, before commits, before pushes, at factory gates, and when a task crosses local, GitHub, Cloudflare, or production boundaries.
---

# Agent workflow

## When to Use

Use for any session that edits code, deploys, changes DNS, touches a shared
runtime, or hands work to another agent.

## When NOT to Use

Do not use for read-only questions, or for a documentation-only edit that ships
no commit. Area work still loads its own skill: this one routes a session, it
does not replace `validation`, `design-gate`, or the Wolves skills.

## Core Process

1. **Identify the real target.**
   ```bash
   git remote -v
   git branch -vv
   git status --short
   ```
   This repository's production remote is `upstream`:
   `git@github.com:projectbluefin/website.git`. A fork must not be used as the
   production destination. Remove an accidental fork remote rather than
   silently pushing there.

2. **Read the owning instructions.** Read `AGENTS.md`, the skill index, and the
   area-specific skill before editing. Design/runtime work requires explicit
   user approval and browser verification.

3. **Keep one compact task record.** When the task arrives as a Hive assignment
   or GitHub issue, resolve it through the API first and verify the repository,
   issue, branch target, and requested scope against it. Maintain one compact
   record for the session — task ID, verified repository and issue, skills
   loaded, evidence, confidence, and learned facts — and hand it off with the
   work. The record lives in the agent's session folder; it is never committed
   (see the banned-artifacts list in
   [`../skill-improvement/SKILL.md`](../skill-improvement/SKILL.md)).

4. **Build a narrow feedback loop first.** For UI/runtime work, use a
   deterministic Chromium flow at desktop and mobile sizes. Measure the actual
   rendered node, computed style, bounds, state, and URL—not just source CSS or
   a build result.

5. **Keep experience boundaries explicit.** Wolves-authored presentation must
   be gated by the Wolves experience identity. Generic album slideshow,
   transport, ads, and controls must remain generic. Never use only a numeric
   track index to identify Wolves content.

6. **Commit the complete fix.** First classify every dirty path; never bundle
   unrelated local deletions into the task. For deleted content, search all
   manifests, imports, timelines, and generated-data sources before committing.
   Stage explicit paths only. Include regression coverage in the same commit.
   Use the repository's Conventional Commits format (`type(scope): description`).
   Carry both attribution trailers (see `## Commit attribution`).
   Do not leave a tested fix uncommitted.

7. **Publish only when requested.** Local-only work stays local. When the owner
   asks to publish, push the named feature branch and open a PR against `main`;
   never push the protected branch directly.
   ```bash
   branch=$(git branch --show-current)
   git push -u upstream "$branch"
   ```
   PR readiness is proved by CI/preview for the feature-branch SHA. Production
   verification happens only after the queue has merged the PR.

8. **Merge through the queue, never directly.** When a ruleset requires a
   merge queue, `gh pr merge --merge` prints `! The merge strategy for main is
   set by the merge queue` and does **not** enqueue the PR. It stays `OPEN`
   with no `mergeQueueEntry`. Use `gh pr merge --auto` with no strategy flag,
   then confirm a queue entry exists before waiting:
   ```bash
   gh api graphql -f query='{repository(owner:"projectbluefin",name:"website"){pullRequest(number:<N>){mergeQueueEntry{state position}}}}'
   gh pr view <N> --json reviewDecision,mergeStateStatus
   ```
   `mergeStateStatus: BLOCKED` with `reviewDecision: REVIEW_REQUIRED` means
   auto-merge waits forever for an approval. GitHub refuses self-approval, so a
   PR authored by the agent's own account (the owner's `gh` login) can never
   satisfy the 1-approval rule. With the owner's explicit merge grant, an admin
   identity can merge with `gh pr merge <N> --admin --merge`, bypassing the
   review rule. Say so in the report. Without that grant, report the blocker.
   Then confirm `merged: true` from the pulls API.
   The queue's method is `MERGE`, not squash: it lands a merge commit whose
   second parent is the feature-branch head.
   ```bash
   gh api repos/<owner>/<repo>/rules/branches/main \
     --jq '.[] | select(.type=="merge_queue") | .parameters.merge_method'
   ```
   Approvals gate entry to the queue. If the ruleset enables
   `require_extra_approval_for_unattributed_changes`, PRs opened by the Copilot
   app under its own identity need one more approval than the configured count.
   PRs opened by a person are unaffected; this rule is separate from the commit
   attribution trailers below. Pushing new commits to an approved PR with
   `dismiss_stale_reviews_on_push: true` drops prior approvals back to
   `REVIEW_REQUIRED`.

9. **Verify production, not just localhost.** After merge, fetch canonical
   `main`, query the deployment for that merged SHA, then check the deployed
   URL. The feature-branch SHA is not the merge commit the queue created.
   ```bash
   git fetch upstream main
   sha=$(git rev-parse upstream/main)
   ```
   Use a hard refresh when testing changed bundles. For a route with eager
   manifest loading, open it in Chromium and assert there are no page errors
   or failed module requests; a successful Vite build is not sufficient.

10. **Close the git session.** Because the queue merges rather than squashes,
    a merged feature branch *is* an ancestor of `main` and `git branch --merged`
    does list it -- but ancestry alone still cannot close a session: it says
    nothing about a branch whose PR was closed unmerged, or one that never had
    a PR at all. After a merge, move any preserved edits to a fresh branch,
    remove the completed worktree and branch, and prune Git's metadata.
    Before every handoff, run:
    ```bash
    git worktree prune
    npm run check:git-hygiene
    ```
    The checker uses GitHub PR state as well as Git ancestry and inspects every
    local branch, not only branches mounted in `git worktree list`. It fails on
    merged/closed PR branches, clean worktrees with no open PR, unpublished
    clean branches, detached worktrees, and prunable metadata. It never deletes
    automatically because dirty state and unique commits require human review.

## Commit attribution

Every AI-authored commit carries both trailers, naming the model and tool
actually driving the session:

```
Assisted-by: <Model> via GitHub Copilot CLI
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

The factory canonical form is `via GitHub Copilot`; this repository's history
uses `via GitHub Copilot CLI`. Either satisfies the gate — both trailers are
mandatory, and `Co-authored-by` alone does not satisfy the factory contract.
Check the exact commits being pushed, not just the latest one:

```bash
git log --format='%h %(trailers)' upstream/main..HEAD
```

## Human gates

The factory names four gates. At any of them, stop and request explicit human
approval; never guess past a gate. When in doubt, the gate applies.

- **Design** — layout, components, styles, animation, navigation, or behavior
  visible to users. The `/wolves/experience/` presentation is frozen design. Load
  [`../design-gate/SKILL.md`](../design-gate/SKILL.md).
- **Security** — credentials, secrets, tokens, signing, attestation, or
  third-party package and supply-chain sources. Maintainer review is required
  regardless of how minor the change appears.
- **Breakage** — removing or renaming a public input, changing a default that
  consumers depend on, or anything that could break another factory
  repository. Identify every affected consumer and list it before opening the
  PR.
- **Merge** — never force-push a protected branch. Agents do not self-merge by
  default. The exception is a merge authority the owner grants in the current
  session, in that session's words: it is session-scoped, never assumed, never
  inherited from a previous session, a handoff, or another agent's transcript,
  and not implied by approval of the change itself. If publication was
  requested, open the PR and stop; otherwise preserve the work locally. When
  merging under a grant, name the grant in the report.

A gate asks the owner for a decision. When the owner has already made that
decision — by requesting the change in their own words — implement it and note
the touched surface in the report instead of asking again. What the request did
not cover is still gated: inferred scope, adjacent surfaces, and opportunistic
refactors. See `## Granted authority` in `AGENTS.md`.

Production claims are gated locally in the same way: a change is not live
until the exact pushed commit's deployment workflow and affected route are
verified. See [`../validation/SKILL.md`](../validation/SKILL.md).

## Signalling a gate

1. Stop before opening a PR. Present the branch, the diff, and the decision
   needed.
2. Describe the gate: the proposed change, the property or surface affected,
   your approach, and any alternatives.
3. Do not mutate lifecycle labels unless a repository-owned workflow and an
   explicit local procedure authorize it.
4. Wait for explicit human approval before opening the PR.

## PR evidence

Before removing draft status and requesting review, all five must hold:

- [ ] CI is passing, with the run linked in the PR description.
- [ ] Where no automated test covers the change, the PR describes how it was
      manually verified.
- [ ] The skill file update is committed in this same PR, not a follow-up.
- [ ] The PR title follows Conventional Commits (`feat:`, `fix:`, `docs:`, ...).
- [ ] Every AI-authored commit carries both attribution trailers.

A PR without evidence is not ready.

## Temporary artifacts

Use `/var/tmp/website-agent/` for logs, screenshots, browser fixtures, and
handoff documents. Never use `/tmp` for session artifacts.

## Cloudflare boundary

Use the authenticated `wrangler` CLI and current Cloudflare documentation for
Cloudflare operations. Do not invent a Worker, proxy, redirect, or routing
layer when a DNS/custom-domain configuration is requested. A Worker deployment
is an application change and requires explicit approval.

Before a Cloudflare operation:

```bash
wrangler whoami
wrangler docs <topic>
```

If the session lacks DNS-edit permission, stop and request reauthentication with
an API token scoped to the target zone. Do not compensate by deploying a Worker.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The change is obviously right, so it can skip the gate." | Design, Security, Breakage and Merge are decisions someone else owns, not formalities. Stop and get the decision. |
| "There is a `common` checkout right here." | A fork or feature-branch checkout is not the sidecar. Fetch canonical `main`, or proceed without it and say so. |
| "It works locally, so it shipped." | A change that exists only in a working tree has shipped nothing. Verify the pushed commit's own deployment. |
| "That suite failure is unrelated to my change." | Report it anyway. An omitted failure is how a real regression gets attributed to the next person. |

## Red Flags

- `origin` points at a fork while production is `projectbluefin/*`.
- A fix is described as shipped while it exists only in the working tree.
- A local mock passes but no real rendered production state was checked.
- A generic album is gated out because it shares a component with Wolves.
- A custom Worker is deployed to solve a DNS request without approval.
- A full suite failure is omitted from the completion report.
- A deleted file remains referenced by `import.meta.glob()`, a manifest, or a
  narrative timeline.
- A local build is treated as proof that route initialization succeeds.
- A commit authored by an agent is missing the `Assisted-by` or
  `Co-authored-by` trailer.
- A merged/closed PR branch remains checked out, or a clean worktree has no
  open PR and is kept "just in case."
- A PR opened speculatively past a factory gate, or review requested without
  the five evidence items.
- A fork or feature-branch checkout of `common` cited as the shared contract.
- Local-only work published without the owner's request.

## Verification

- [ ] `git status --short` is clean or remaining files are explicitly explained.
- [ ] For a production claim, the exact merged `upstream/main` SHA is verified.
- [ ] Relevant unit and browser tests pass.
- [ ] A browser smoke check opened every affected route with no page errors or
      failed module requests.
- [ ] Desktop and mobile rendered bounds were checked for design changes.
- [ ] Cloudflare changes used `wrangler` and documented permissions.
- [ ] The exact commit's CI/deploy status is reported.
- [ ] Every AI-authored commit carries both attribution trailers.
- [ ] `npm run check:git-hygiene` passes after completed branches/worktrees are
      removed and `git worktree prune` runs.
- [ ] Gate stops described the blocked decision and were explicitly approved
      before any PR was opened.

## Sources

- Cloudflare Workers SDK: `/cloudflare/workers-sdk`
- Cloudflare Wrangler deploy route configuration (`custom_domain = true`)
