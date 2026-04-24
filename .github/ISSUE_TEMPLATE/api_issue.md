name: ⚠️ API Issue
description: Report API-specific issues (rate limits, downtime, incorrect data)
title: "[API] "
labels: ["api", "bug"]
assignees: []
body:

- type: markdown
  attributes:
    value: |
      Report issues with the Docker Hub API integration.

- type: dropdown
  id: issue-type
  attributes:
    label: Issue Type
    description: What type of API issue?
    options:
      - Docker Hub API rate limit
      - Docker Hub API downtime
      - Incorrect data returned
      - Timeout/Connection error
      - Authentication issue
      - Other
  validations:
    required: true

- type: input
  id: endpoint
  attributes:
    label: Affected Endpoint
    description: Which endpoint is affected?
    placeholder: "/api/repo/details"
  validations:
    required: true

- type: textarea
  id: request
  attributes:
    label: Request Details
    description: Full request URL and parameters
    placeholder: |
      URL: https://docker-hub-pull-counter.vercel.app/api/...
      Method: GET
      Params: {...}
    render: bash
  validations:
    required: true

- type: textarea
  id: response
  attributes:
    label: Response
    description: What response did you get?
    placeholder: |
      Status: 500
      Body: {...}
    render: json
  validations:
    required: true

- type: input
  id: frequency
  attributes:
    label: Frequency
    description: How often does this happen?
    placeholder: "Always / Intermittent / Once"
  validations:
    required: true

- type: textarea
  id: additional
  attributes:
    label: Additional Context
    description: Any other details
  validations:
    required: false
