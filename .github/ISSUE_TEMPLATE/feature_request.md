name: 🚀 Feature Request
description: Suggest a new feature or enhancement
title: "[Feature] "
labels: ["enhancement"]
assignees: []
body:

- type: markdown
  attributes:
    value: |
      Thanks for suggesting a feature! Please fill out the form below.

- type: textarea
  id: problem
  attributes:
    label: Problem Statement
    description: What problem does this feature solve?
    placeholder: "I'm always frustrated when..."
  validations:
    required: true

- type: textarea
  id: solution
  attributes:
    label: Proposed Solution
    description: What do you want to happen?
    placeholder: "I would like to see..."
  validations:
    required: true

- type: textarea
  id: examples
  attributes:
    label: Example Usage
    description: How would this feature be used? Include API examples
    placeholder: |
      GET /api/new-endpoint?param=value
    render: bash
  validations:
    required: false

- type: textarea
  id: alternatives
  attributes:
    label: Alternative Solutions
    description: What alternatives have you considered?
    placeholder: "I've also thought about..."
  validations:
    required: false

- type: dropdown
  id: priority
  attributes:
    label: Priority
    description: How important is this feature?
    options:
      - Critical (Blocking my work)
      - High (Would significantly improve workflow)
      - Medium (Nice to have)
      - Low (Future consideration)
  validations:
    required: true

- type: textarea
  id: additional
  attributes:
    label: Additional Context
    description: Any other details, mockups, or references
  validations:
    required: false
