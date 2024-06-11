import * as core from '@actions/core'
import * as github from '@actions/github'
import type {components} from '@octokit/openapi-types'

async function wait(ms: number): Promise<void> {
  new Promise(resolve => setTimeout(resolve, ms))
}

// ref: https://docs.github.com/en/rest/commits/statuses?apiVersion=2022-11-28#create-a-commit-status
type CommitStatusState = 'error' | 'failure' | 'pending' | 'success'

// calculate conclusion based on steps
// `job.conclusion` cannot be used because this action itself is one step of the job
// `job.conclusion` is always null while this action is executing
function getJobStatus(job: components['schemas']['job']): CommitStatusState {
  if (job.steps?.find(step => step.conclusion === 'failure')) return 'failure'
  if (job.steps?.find(step => step.conclusion === 'cancelled')) return 'error'
  return 'success'
}

async function cleanup(): Promise<void> {
  // wait for propagation
  core.info('Wait 10s for job steps status to propagate to GitHub API')
  await wait(10 * 1000)
  // retrieve states
  const jobId = Number(core.getState('job-id-num'))
  const sha = core.getState('commit-status-sha')
  const commitStatusContext = core.getState('commit-status-context')
  // bail out if states are not found
  if (!jobId || !sha || !commitStatusContext) {
    throw new Error('Error: Cannot find saved states')
  }
  // start cleanup
  const context = github.context
  core.debug(JSON.stringify(context, null, 2))
  // list jobs for the workflow run
  const octokit = github.getOctokit(core.getInput('github_token'))
  const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
    filter: 'latest',
    per_page: 100
  })
  core.debug(JSON.stringify(jobs, null, 2))
  // find the current job
  const job = jobs.data.jobs.find(j => j.id === jobId)
  // throw error if the job is not found
  if (!job) {
    throw new Error(`Error: Cannot find job: ${jobId}`)
  }
  // set commit status
  const state = getJobStatus(job)
  const createCommitStatus = await octokit.rest.repos.createCommitStatus({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    state,
    context: commitStatusContext,
    target_url: job.html_url ?? undefined
  })
  core.debug(JSON.stringify(createCommitStatus, null, 2))
}

// entrypoint
cleanup().catch(error => core.warning((error as Error).message ?? `Error: ${error}`))
