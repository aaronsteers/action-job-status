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
async function startup() {
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
    const job = jobs.data.jobs.find(j => j.name === context.job);
    // throw error if the job is not found
    if (!job) {
        throw new Error(`Error: Cannot find job: ${context.job}`);
    }
    // set commit status to pending
    const sha = core.getInput('commit_sha') ||
        context.payload.workflow_run?.head_sha ||
        context.payload.commit?.sha ||
        context.sha;
    const event = context.payload.workflow_run
        ? ` (${context.payload.workflow_run.event} → ${context.eventName})`
        : ``;
    const commitStatusContext = `${context.workflow} / ${job.name}${event}`;
    const state = 'pending';
    const createCommitStatus = await octokit.rest.repos.createCommitStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        sha,
        state,
        context: commitStatusContext,
        target_url: job.html_url ?? undefined
    });
    core.debug(JSON.stringify(createCommitStatus, null, 2));
    // save commit status details
    core.saveState('job-id-num', job.id);
    core.saveState('commit-status-sha', sha);
    core.saveState('commit-status-context', commitStatusContext);
}
// entrypoint
try {
    startup();
}
catch (error) {
    core.setFailed(error?.message ?? `Error: ${error}`);
}
//# sourceMappingURL=index.js.map