# MailBrew GitHub Actions

Official GitHub Actions for [MailBrew](https://mailbrew.dev) — E2E email testing in your CI pipeline.

> **Migrating from `brewmail/*` actions?** The actions were renamed to `mailbrew/*`. See [Migration](#migration) below.

## Actions

| Action | Description |
|--------|-------------|
| `mailbrew/setup` | Install CLI and configure API key |
| `mailbrew/create-address` | Create a temporary email address |
| `mailbrew/assert-email` | Assert email properties (subject, body, sender) |

## Quick Start

```yaml
name: E2E Email Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. Install MailBrew CLI
      - uses: mailbrew/setup@v2
        with:
          api-key: ${{ secrets.MAILBREW_API_KEY }}

      # 2. Create a temporary email address
      - uses: mailbrew/create-address@v2
        id: email
        with:
          ttl: 300

      # 3. Your app sends an email
      - name: Trigger signup email
        run: |
          curl -X POST http://localhost:3000/signup \
            -d "email=${{ steps.email.outputs.address }}"

      # 4. Assert the email arrived with correct content
      - uses: mailbrew/assert-email@v2
        with:
          address: ${{ steps.email.outputs.address }}
          subject-contains: "Welcome"
          body-contains: "verify your email"
          timeout: 30
```

## Setup Action

Installs the MailBrew CLI and sets the API key in the environment.

```yaml
- uses: mailbrew/setup@v2
  with:
    api-key: ${{ secrets.MAILBREW_API_KEY }}
    # base-url: https://mailbrew.dev  # optional
    # version: latest                  # optional
```

## Create Address Action

Creates a temporary email address and outputs it for use in later steps.

```yaml
- uses: mailbrew/create-address@v2
  id: email
  with:
    ttl: 300  # 5 minutes

- run: echo "Email address: ${{ steps.email.outputs.address }}"
```

## Assert Email Action

Waits for an email and asserts its properties. Results are posted to the GitHub Job Summary.

```yaml
- uses: mailbrew/assert-email@v2
  with:
    address: ${{ steps.email.outputs.address }}
    subject-contains: "Welcome"
    body-contains: "verify"
    from: "noreply@example.com"
    timeout: 30
```

### Outputs

| Output | Description |
|--------|-------------|
| `passed` | `true` or `false` |
| `result` | Full assertion result text |

### Using outputs in subsequent steps

```yaml
- uses: mailbrew/assert-email@v2
  id: check
  continue-on-error: true
  with:
    address: ${{ steps.email.outputs.address }}
    subject-contains: "Welcome"

- if: steps.check.outputs.passed == 'false'
  run: echo "Email assertion failed!"
```

## Advanced: Sequence Testing

Use the CLI directly for email sequence testing:

```yaml
- name: Verify email sequence
  run: |
    mailbrew sequence ${{ steps.email.outputs.address }} \
      --step "subject_contains:Verify your email" \
      --step "subject_contains:Welcome" \
      --timeout 60
```

## Job Summary

The assert-email action automatically writes results to the GitHub Job Summary, showing pass/fail status with details for each assertion.

## Migration

In v2.0:

| Before | After |
| ------ | ----- |
| `uses: brewmail/setup@v1` | `uses: mailbrew/setup@v2` |
| `uses: brewmail/create-address@v1` | `uses: mailbrew/create-address@v2` |
| `uses: brewmail/assert-email@v1` | `uses: mailbrew/assert-email@v2` |
| `secrets.BREWMAIL_API_KEY` | `secrets.MAILBREW_API_KEY` |
| `BREWMAIL_*` env vars | `MAILBREW_*` |

The CLI command (`mailbrew`), action inputs, and outputs are unchanged.
