import * as core from '@actions/core'
import * as github from '@actions/github'

async function startup(): Promise<void> {
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
  const job = jobs.data.jobs.find(j => j.name === context.job)
  // throw error if the job is not found
  if (!job) {
    throw new Error(`Error: Cannot find job: ${context.job}`)
  }
  // set commit status to pending
  const sha =
    core.getInput('commit_sha') ||
    context.payload.workflow_run?.head_sha ||
    context.payload.commit?.sha ||
    context.sha
  const event = context.payload.workflow_run
    ? ` (${context.payload.workflow_run.event} → ${context.eventName})`
    : ``
  const commitStatusContext = `${context.workflow} / ${job.name}${event}`
  const state = 'pending'
  const createCommitStatus = await octokit.rest.repos.createCommitStatus({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    state,
    context: commitStatusContext,
    target_url: job.html_url ?? undefined
  })
  core.debug(JSON.stringify(createCommitStatus, null, 2))
  // save commit status details
  core.saveState('job-id-num', job.id)
  core.saveState('commit-status-sha', sha)
  core.saveState('commit-status-context', commitStatusContext)
}

// entrypoint
try {
  startup()
} catch (error) {
  core.setFailed((error as Error)?.message ?? `Error: ${error}`)
}
