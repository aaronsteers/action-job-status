import * as core from '@actions/core'
import * as github from '@actions/github'
import type {components} from '@octokit/openapi-types'

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ref: https://docs.github.com/en/rest/commits/statuses?apiVersion=2022-11-28#create-a-commit-status
type CommitStatusState = 'error' | 'failure' | 'pending' | 'success'

// calculate conclusion based on steps
// `job.conclusion` cannot be used because this action itself is one step of the job
// `job.conclusion` is always null while this action is executing
function getJobStatus(job: components['schemas']['job']): CommitStatusState {
  core.startGroup(`Calculate job conclusion from steps`)
  job.steps?.forEach(step => core.info(`Step "${step.name}": ${step.conclusion}`))
  core.endGroup()
  if (job.steps?.find(step => step.conclusion === 'failure')) return 'failure'
  if (job.steps?.find(step => step.conclusion === 'cancelled')) return 'error'
  return 'success'
}

async function cleanup(): Promise<void> {
  // wait for propagation
  const delay = 10
  core.info(`Wait ${delay}s for job steps status to propagate to GitHub API`)
  core.debug(new Date().toISOString())
  await wait(delay * 1000)
  core.debug(new Date().toISOString())
  // retrieve states
  const jobId = Number(core.getState('job-id-num'))
  const sha = core.getState('commit-status-sha')
  const commitStatusContext = core.getState('commit-status-context')
  // bail out if states are not found
  if (!jobId || !sha || !commitStatusContext) {
    throw new Error('Cannot retrieve saved states')
  }
  core.startGroup('Retrieve saved states')
  core.info(`job-id-num: ${jobId}`)
  core.info(`commit-status-sha: ${sha}`)
  core.info(`commit-status-context: ${commitStatusContext}`)
  core.endGroup()
  // start cleanup
  const context = github.context
  // list jobs for the workflow run
  const octokit = github.getOctokit(core.getInput('github_token'))
  const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
    filter: 'latest',
    per_page: 100
  })
  // log fetched jobs
  core.startGroup(`Find the current job`)
  core.info(`context.runId: ${context.runId}`)
  core.info(`context.job: ${context.job}`)
  core.info(`Jobs:`)
  jobs.data.jobs.forEach(job => core.info(`  Job ${job.id}: ${job.name}`))
  core.endGroup()
  // find the current job
  const job = jobs.data.jobs.find(j => j.id === jobId)
  // throw error if the job is not found
  if (!job) {
    throw new Error(`Cannot find job: ${jobId}`)
  }
  // set commit status
  const state = getJobStatus(job)
  core.startGroup(`Create commit status`)
  core.info(`SHA: ${sha}`)
  core.info(`Context: ${commitStatusContext}`)
  core.info(`State: ${state}`)
  core.endGroup()
  const createCommitStatus = await octokit.rest.repos.createCommitStatus({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    state,
    context: commitStatusContext,
    target_url: job.html_url ?? undefined
  })
  core.debug(JSON.stringify(createCommitStatus, null, 2))
  core.info(`Commit status created`)
}

// entrypoint
cleanup().catch(error => core.warning(`Error: ${(error as Error).message ?? error}`))
