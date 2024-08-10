import * as core from '@actions/core'
import * as github from '@actions/github'

async function startup(): Promise<void> {
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
  // log context
  core.startGroup(`Find the current job`)
  core.info(`context.runId: ${context.runId}`)
  core.info(`context.job: ${context.job}`)
  // append matrix label if any
  let currentJob = context.job
  const jobName = core.getInput('job_name');
  if (jobName) {
      currentJob = `${jobName}`;
      core.info(`jobName: ${jobName}`);
  }
  // list fetched jobs
  core.info(`Jobs:`)
  jobs.data.jobs.forEach(job => core.info(`  Job ${job.id}: ${job.name}`))
  core.endGroup()
  // find the current job
  const job = jobs.data.jobs.find(j => j.name === currentJob)
  // throw error if the job is not found
  if (!job) {
    throw new Error(`Cannot find job: ${currentJob}`)
  }
  // set commit status
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
  // save commit status details
  core.saveState('job-id-num', job.id)
  core.saveState('commit-status-sha', sha)
  core.saveState('commit-status-context', commitStatusContext)
}

// entrypoint
startup().catch(error => core.setFailed(`Error: ${(error as Error).message ?? error}`))
