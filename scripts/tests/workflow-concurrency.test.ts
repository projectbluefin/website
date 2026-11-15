import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

const workflow = load(readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8')) as {
  concurrency: { 'group': string, 'cancel-in-progress': string }
}

function policy(eventName: string, runId: number, pullRequestNumber?: number) {
  expect(workflow.concurrency.group).toBe(`\${{ github.workflow }}-\${{ github.event_name }}-\${{ github.event_name == 'pull_request' && github.event.pull_request.number || github.run_id }}`)
  expect(workflow.concurrency['cancel-in-progress']).toBe(`\${{ github.event_name == 'pull_request' }}`)
  const identifier = eventName === 'pull_request' ? (pullRequestNumber || runId) : runId
  return {
    group: `CI-${eventName}-${identifier}`,
    cancel: String(eventName === 'pull_request'),
  }
}

describe('ci concurrency', () => {
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
