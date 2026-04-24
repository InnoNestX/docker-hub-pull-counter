name: 🐛 Bug Report
description: Report a bug or unexpected behavior
title: "[Bug] "
labels: ["bug"]
assignees: []
body:

- type: markdown
  attributes:
    value: |
      Thanks for taking the time to report a bug! Please fill out the form below.

- type: input
  id: endpoint
  attributes:
    label: API Endpoint
    description: Which endpoint is affected? (e.g., /api/user/stats)
    placeholder: "/api/user/stats"
  validations:
    required: false

- type: input
  id: request-url
  attributes:
    label: Request URL
    description: Full URL you called (hide sensitive data)
    placeholder: "https://docker-hub-pull-counter.vercel.app/api/user/stats?username=..."
  validations:
    required: false

- type: dropdown
  id: severity
  attributes:
    label: Severity
    description: How severe is this bug?
    options:
      - Critical (API completely broken)
      - High (Major feature broken)
      - Medium (Minor issue, workaround exists)
      - Low (Cosmetic, typo, etc.)
  validations:
    required: true

- type: textarea
  id: description
  attributes:
    label: Bug Description
    description: Clearly describe what happened
    placeholder: "When I call the API with X parameters, it returns Y instead of Z..."
  validations:
    required: true

- type: textarea
  id: expected
  attributes:
    label: Expected Behavior
    description: What should happen?
    placeholder: "The API should return..."
  validations:
    required: true

- type: textarea
  id: actual
  attributes:
    label: Actual Behavior
    description: What actually happened? Include error messages or response JSON
    placeholder: "Got 500 error with message: ..."
    render: json
  validations:
    required: true

- type: textarea
  id: reproduce
  attributes:
    label: Steps to Reproduce
    description: How can we reproduce this?
    placeholder: |
      1. Call endpoint: GET /api/...
      2. With parameters: ...
      3. See error: ...
    render: bash
  validations:
    required: false

- type: input
  id: timestamp
  attributes:
    label: Timestamp
    description: When did this happen? (UTC)
    placeholder: "2026-04-06 15:00 UTC"
  validations:
    required: false

- type: textarea
  id: additional
  attributes:
    label: Additional Context
    description: Any other details, screenshots, or logs
  validations:
    required: false
