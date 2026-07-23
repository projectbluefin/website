---
name: agent-workflow
description: Use at session start, before commits, before pushes, and when a task crosses local, GitHub, Cloudflare, or production boundaries.
---

# Agent workflow

## When to Use

Use for any session that edits code, deploys, changes DNS, touches a shared
runtime, or hands work to another agent.

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

3. **Build a narrow feedback loop first.** For UI/runtime work, use a
   deterministic Chromium flow at desktop and mobile sizes. Measure the actual
   rendered node, computed style, bounds, state, and URL—not just source CSS or
   a build result.

4. **Keep experience boundaries explicit.** Wolves-authored presentation must
   be gated by the Wolves experience identity. Generic album slideshow,
   transport, ads, and controls must remain generic. Never use only a numeric
   track index to identify Wolves content.

5. **Commit the complete fix.** First classify every dirty path; never bundle
   unrelated local deletions into the task. For deleted content, search all
   manifests, imports, timelines, and generated-data sources before committing.
   Stage explicit paths only. Include regression coverage in the same commit.
   Use the repository's Conventional Commits format (`type(scope): description`).
   Do not leave a tested fix uncommitted.

6. **Push the production remote.**
   ```bash
   git push upstream main
   sha=$(git rev-parse HEAD)
   ```
   Verify the deployment workflow for that exact SHA before calling it live.

7. **Verify production, not just localhost.** Check the deployed URL after the
   workflow succeeds. Use a hard refresh when testing changed bundles. For a
   route with eager manifest loading, open it in Chromium and assert there are
   no page errors or failed module requests; a successful Vite build is not
   sufficient.

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

## Verification

- [ ] `git status --short` is clean or remaining files are explicitly explained.
- [ ] The exact commit is on `upstream/main`.
- [ ] Relevant unit and browser tests pass.
- [ ] A browser smoke check opened every affected route with no page errors or
      failed module requests.
- [ ] Desktop and mobile rendered bounds were checked for design changes.
- [ ] Cloudflare changes used `wrangler` and documented permissions.
- [ ] The exact commit's CI/deploy status is reported.

## Sources

- Cloudflare Workers SDK: `/cloudflare/workers-sdk`
- Cloudflare Wrangler deploy route configuration (`custom_domain = true`)

## Lessons learned

- Always state exactly which source is active; “restored” is ambiguous after a failed experiment.
- Preserve dirty user edits and classify every path before staging.
- For timing changes, document anchors, estimator rules, tests, generated output, and browser observations.
- Never call focused green tests a full-suite pass.
