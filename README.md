# BrewMail GitHub Actions

Official GitHub Actions for [BrewMail](https://brewmail.dev) — E2E email testing in your CI pipeline.

## Actions

| Action | Description |
|--------|-------------|
| `brewmail/setup` | Install CLI and configure API key |
| `brewmail/create-address` | Create a temporary email address |
| `brewmail/assert-email` | Assert email properties (subject, body, sender) |

## Quick Start

```yaml
name: E2E Email Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. Install BrewMail CLI
      - uses: brewmail/setup@v1
        with:
          api-key: ${{ secrets.BREWMAIL_API_KEY }}

      # 2. Create a temporary email address
      - uses: brewmail/create-address@v1
        id: email
        with:
          ttl: 300

      # 3. Your app sends an email
      - name: Trigger signup email
        run: |
          curl -X POST http://localhost:3000/signup \
            -d "email=${{ steps.email.outputs.address }}"

      # 4. Assert the email arrived with correct content
      - uses: brewmail/assert-email@v1
        with:
          address: ${{ steps.email.outputs.address }}
          subject-contains: "Welcome"
          body-contains: "verify your email"
          timeout: 30
```

## Setup Action

Installs the BrewMail CLI and sets the API key in the environment.

```yaml
- uses: brewmail/setup@v1
  with:
    api-key: ${{ secrets.BREWMAIL_API_KEY }}
    # base-url: https://brewmail.dev  # optional
    # version: latest                  # optional
```

## Create Address Action

Creates a temporary email address and outputs it for use in later steps.

```yaml
- uses: brewmail/create-address@v1
  id: email
  with:
    ttl: 300  # 5 minutes

- run: echo "Email address: ${{ steps.email.outputs.address }}"
```

## Assert Email Action

Waits for an email and asserts its properties. Results are posted to the GitHub Job Summary.

```yaml
- uses: brewmail/assert-email@v1
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
- uses: brewmail/assert-email@v1
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
