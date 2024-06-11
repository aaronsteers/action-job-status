"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
async function wait(ms) {
    new Promise(resolve => setTimeout(resolve, ms));
}
// calculate conclusion based on steps
// `job.conclusion` cannot be used because this action itself is one step of the job
// `job.conclusion` is always null while this action is executing
function getJobStatus(job) {
    if (job.steps?.find(step => step.conclusion === 'failure'))
        return 'failure';
    if (job.steps?.find(step => step.conclusion === 'cancelled'))
        return 'error';
    return 'success';
}
async function cleanup() {
    // wait for propagation
    core.info('Wait 10s for job steps status to propagate to GitHub API');
    await wait(10 * 1000);
    // retrieve states
    const jobId = new Number(core.getState('job-id-num'));
    const sha = core.getState('commit-status-sha');
    const commitStatusContext = core.getState('commit-status-context');
    // bail out if states are not found
    if (!jobId || !sha || !commitStatusContext) {
        throw new Error('Error: Cannot find saved states');
    }
    // start cleanup
    const context = github.context;
    core.debug(JSON.stringify(context, null, 2));
    // list jobs for the workflow run
    const octokit = github.getOctokit(core.getInput('github_token'));
    const jobs = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: context.repo.owner,
        repo: context.repo.repo,
        run_id: context.runId,
        filter: 'latest',
        per_page: 100
    });
    core.debug(JSON.stringify(jobs, null, 2));
    // find the current job
    const job = jobs.data.jobs.find(j => j.id === jobId);
    // throw error if the job is not found
    if (!job) {
        throw new Error(`Error: Cannot find job: ${jobId}`);
    }
    // set commit status
    const state = getJobStatus(job);
    const createCommitStatus = await octokit.rest.repos.createCommitStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha,
        state,
        context: commitStatusContext,
        target_url: job.html_url ?? undefined
    });
    core.debug(JSON.stringify(createCommitStatus, null, 2));
}
// entrypoint
try {
    cleanup();
}
catch (error) {
    core.warning(error?.message ?? `Error: ${error}`);
}
//# sourceMappingURL=cleanup.js.map