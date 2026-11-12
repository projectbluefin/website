import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

const workflow = load(readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8')) as {
  concurrency: { group: string, 'cancel-in-progress': string }
}

// The workflow uses the common GitHub expression operators that also have JS equivalents.
function evaluate(template: string, github: object) {
  return template.replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, expression: string) =>
    String(Function('github', `return (${expression})`)(github)))
}

function policy(eventName: string, runId: number, pullRequestNumber?: number) {
  const github = {
    workflow: 'CI',
    event_name: eventName,
    event: { pull_request: { number: pullRequestNumber } },
    run_id: runId,
  }
  return {
    group: evaluate(workflow.concurrency.group, github),
    cancel: evaluate(workflow.concurrency['cancel-in-progress'], github),
  }
}

describe('CI concurrency', () => {
  it('cancels older runs only within the same pull request', () => {
    const first = policy('pull_request', 100, 12)
    const update = policy('pull_request', 101, 12)
    const other = policy('pull_request', 102, 13)
    expect(first.cancel).toBe('true')
    expect(update.cancel).toBe('true')
    expect(first.group).toBe(update.group)
    expect(first.group).not.toBe(other.group)
  })

  it.each(['push', 'merge_group'])('keeps %s runs independent', (eventName) => {
    const first = policy(eventName, 100)
    const second = policy(eventName, 101)
    expect(first.cancel).toBe('false')
    expect(second.cancel).toBe('false')
    expect(first.group).not.toBe(second.group)
  })
})
