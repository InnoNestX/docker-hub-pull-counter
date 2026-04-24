name: 📦 Pull Request
description: Submit code changes to the project
title: ""
labels: []
assignees: []

body:

- type: markdown
  attributes:
    value: |
      Thanks for your contribution! Please fill out the form below.

- type: input
  id: issue
  attributes:
    label: Related Issue
    description: Link to the issue this PR addresses
    placeholder: "Fixes #123"
  validations:
    required: false

- type: dropdown
  id: type
  attributes:
    label: PR Type
    description: What type of change is this?
    options:
      - 🐛 Bug Fix
      - ✨ New Feature
      - 📝 Documentation
      - ♻️ Refactor
      - 🎨 Style/Formatting
      - ⚡ Performance
      - 🧪 Tests
      - 🔒 Security
      - 📦 Build/Deploy
      - Other
  validations:
    required: true

- type: textarea
  id: description
  attributes:
    label: Description
    description: Briefly describe your changes
    placeholder: "This PR adds/fixes/changes..."
  validations:
    required: true

- type: textarea
  id: changes
  attributes:
    label: Changes Made
    description: List the key changes
    placeholder: |
      - Modified server.js to handle X
      - Added new endpoint /api/...
      - Updated index.html with Y
  validations:
    required: true

- type: textarea
  id: testing
  attributes:
    label: Testing Done
    description: How did you test this?
    placeholder: |
      - [ ] Tested locally
      - [ ] Tested on Vercel staging
      - [ ] Added unit tests
      - [ ] Manual API testing with curl/Postman
  validations:
    required: true

- type: textarea
  id: checklist
  attributes:
    label: Checklist
    description: Before submitting, please confirm:
    placeholder: |
      - [ ] My code follows the project style
      - [ ] I have commented my code
      - [ ] I have updated documentation
      - [ ] My changes generate no new warnings
      - [ ] I have tested the API endpoints
  validations:
    required: true

- type: textarea
  id: screenshots
  attributes:
    label: Screenshots (if applicable)
    description: Add screenshots of UI changes or API responses
  validations:
    required: false

- type: textarea
  id: additional
  attributes:
    label: Additional Notes
    description: Anything else reviewers should know
  validations:
    required: false
