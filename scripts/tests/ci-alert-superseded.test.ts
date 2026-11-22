import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

// The cancellation supersession step decides whether a cancelled main push was
// already replaced by a newer eligible run, so the alert should be suppressed.
// This locks both the bug this change fixes (the unsupported `-G` flag) and the
// cancellation filtering that the jq expression encodes.
const workflow = load(
  readFileSync(resolve(process.cwd(), '.github/workflows/ci-alert.yml'), 'utf8'),
) as {
  jobs: {
    alert: {
      steps: { id?: string, name?: string, run?: string }[]
    }
  }
}

function supersededShell(): string {
  const step = workflow.jobs.alert.steps.find(s => s.id === 'superseded')
  expect(step, 'the superseded step must exist').toBeTruthy()
  expect(typeof step?.run, 'the superseded step must run shell').toBe('string')
  return step!.run as string
}

// The jq filter is the "filtering" the issue says to preserve. Run the exact
// string from the workflow against fixtures, not a hand reimplementation, so a
// future edit to the filter is caught here.
function jqFilter(shell: string): string {
  const match = shell.match(/jq\s+-r\b[\s\S]*?'((?:[^'\\]|\\.)*)'/)
  expect(match, 'the superseded step must run a single quoted jq filter').toBeTruthy()
  return match![1]
}

function runFilter(filter: string, runNumber: number, pages: unknown[]): string {
  // `gh api --paginate --slurp` concatenates every page into one JSON array, so
  // each fixture page is wrapped exactly as the real endpoint returns it.
  return execFileSync('jq', [
    '-r',
    '--argjson',
    'number',
    String(runNumber),
    filter
  ], {
    input: JSON.stringify(pages),
  })
    .toString()
    .trim()
}

describe('ci-alert superseded step', () => {
  it('uses explicit --method GET, not the unsupported -G shorthand', () => {
    const shell = supersededShell()
    // The runs query passes -f fields, so gh defaults to POST. -G was never a
    // valid gh flag: it aborted with "unknown shorthand flag: 'G'" before the
    // request was sent, so the supersession check never ran.
    expect(shell).not.toMatch(/\s-G\b/)
    expect(shell).toContain('--method GET')
  })

  it.each([
    {
      name: 'suppresses when a newer eligible push run exists',
      pages: [
        {
          workflow_runs: [
            { run_number: 100, event: 'push', id: 'run-100' },
            { run_number: 101, event: 'push', id: 'run-101' },
          ]
        },
      ],
      expected: 'run-101',
    },
    {
      name: 'does not suppress when no newer run exists',
      pages: [
        {
          workflow_runs: [
            { run_number: 100, event: 'push', id: 'run-100' },
          ]
        },
      ],
      expected: '',
    },
    {
      name: 'does not suppress when the newer run is a PR run',
      pages: [
        {
          workflow_runs: [
            { run_number: 101, event: 'pull_request', id: 'pr-101' },
          ]
        },
      ],
      expected: '',
    },
    {
      name: 'does not suppress when the newer run is a merge-queue run',
      pages: [
        {
          workflow_runs: [
            { run_number: 101, event: 'merge_group', id: 'mg-101' },
          ]
        },
      ],
      expected: '',
    },
    {
      name: 'counts only the eligible newer run when PR and merge-queue runs also exist',
      pages: [
        {
          workflow_runs: [
            { run_number: 101, event: 'pull_request', id: 'pr-101' },
            { run_number: 102, event: 'push', id: 'push-102' },
            { run_number: 103, event: 'merge_group', id: 'mg-103' },
          ]
        },
      ],
      expected: 'push-102',
    },
    {
      name: 'finds the newer run across paginated pages',
      pages: [
        {
          workflow_runs: [
            { run_number: 101, event: 'push', id: 'run-101' }
          ]
        },
        {
          workflow_runs: [
            { run_number: 102, event: 'push', id: 'run-102' }
          ]
        },
      ],
      expected: 'run-102',
    },
  ])('$name', ({ pages, expected }) => {
    const shell = supersededShell()
    const filter = jqFilter(shell)
    expect(runFilter(filter, 100, pages)).toBe(expected)
  })
})
