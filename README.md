# action-job-status

![demo](https://user-images.githubusercontent.com/3797062/89281009-6367de00-d684-11ea-9775-82d2e7c15c42.png)

A workflow triggered by certain events, e.g. `workflow_run` `status`, runs on the default branch. Thus,
its job statuses won't be attached to the initial commit that triggered the chain of events.

This action reports the job status back to the initial commit, in the form of a commit status.

## Usage

Add `ushuz/action-job-status@v1` as the first step in a job:

```yaml
name: Validate
on:
  workflow_run:
    workflows: ["test"]
    types:
      - completed

jobs:
  post-test-success:
    runs-on: ubuntu-latest
    steps:
      - uses: ushuz/action-job-status@v1
      - uses: actions/checkout@v3
      - run: exit 0

  post-test-failure:
    runs-on: ubuntu-latest
    steps:
      - uses: ushuz/action-job-status@v1
      - uses: actions/checkout@v3
      - run: exit 1
```
