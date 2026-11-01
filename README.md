# MailBrew GitHub Actions

Official GitHub Actions for [MailBrew](https://mailbrew.dev) — E2E email testing in your CI pipeline.

> **Note:** These actions are not yet published. `FUNBREW/mailbrew-actions` has no release tags yet, so `uses: FUNBREW/mailbrew-actions/...@v2` does not resolve, and the `setup` action installs `@mailbrew/cli`, which is not yet published to npm either. Until they are, call the REST API with `curl` as shown in [Using the REST API directly (works today)](#using-the-rest-api-directly-works-today).

## Using the REST API directly (works today)

```yaml
name: E2E Email Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      MAILBREW_API_KEY: ${{ secrets.MAILBREW_API_KEY }}
      MAILBREW_API: https://mailbrew.dev/api/mailbrew
    steps:
      - uses: actions/checkout@v4

      # 1. Create a temporary email address (ttl in seconds)
      - name: Create address
        id: email
        run: |
          address=$(curl -fsS -X POST "$MAILBREW_API/addresses" \
            -H "X-API-Key: $MAILBREW_API_KEY" -H "Content-Type: application/json" \
            -d '{"ttl": 300}' | jq -r '.data.address')
          echo "address=$address" >> "$GITHUB_OUTPUT"

      # 2. Your app sends an email
      - name: Trigger signup email
        run: |
          curl -X POST http://localhost:3000/signup \
            -d "email=${{ steps.email.outputs.address }}"

      # 3. Wait for the email (server-side long polling, up to 60 seconds) and assert its content
      - name: Assert email
        run: |
          address="${{ steps.email.outputs.address }}"
          id=$(curl -fsS "$MAILBREW_API/addresses/$address/emails/wait?timeout=30" \
            -H "X-API-Key: $MAILBREW_API_KEY" | jq -r '.data[0].id // empty')
          test -n "$id" || { echo "No email arrived"; exit 1; }
          curl -fsS -X POST "$MAILBREW_API/addresses/$address/emails/$id/assert" \
            -H "X-API-Key: $MAILBREW_API_KEY" -H "Content-Type: application/json" \
            -d '{"subject_contains": "Welcome", "body_contains": "verify your email"}' \
            | jq -e '.data.passed' > /dev/null
```

The API returns `429` with a `Retry-After` header (seconds) when you exceed your plan's rate limit (Free: 10 requests/minute).

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
      - uses: FUNBREW/mailbrew-actions/setup@v2
        with:
          api-key: ${{ secrets.MAILBREW_API_KEY }}

      # 2. Create a temporary email address
      - uses: FUNBREW/mailbrew-actions/create-address@v2
        id: email
        with:
          ttl: 300

      # 3. Your app sends an email
      - name: Trigger signup email
        run: |
          curl -X POST http://localhost:3000/signup \
            -d "email=${{ steps.email.outputs.address }}"

      # 4. Assert the email arrived with correct content
      - uses: FUNBREW/mailbrew-actions/assert-email@v2
        with:
          address: ${{ steps.email.outputs.address }}
          subject-contains: "Welcome"
          body-contains: "verify your email"
          timeout: 30
```

## Setup Action

Installs the MailBrew CLI and sets the API key in the environment.

```yaml
- uses: FUNBREW/mailbrew-actions/setup@v2
  with:
    api-key: ${{ secrets.MAILBREW_API_KEY }}
    # base-url: https://mailbrew.dev  # optional
    # version: latest                  # optional
```

## Create Address Action

Creates a temporary email address and outputs it for use in later steps.

```yaml
- uses: FUNBREW/mailbrew-actions/create-address@v2
  id: email
  with:
    ttl: 300  # 5 minutes

- run: echo "Email address: ${{ steps.email.outputs.address }}"
```

## Assert Email Action

Waits for an email and asserts its properties. Results are posted to the GitHub Job Summary.

```yaml
- uses: FUNBREW/mailbrew-actions/assert-email@v2
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
- uses: FUNBREW/mailbrew-actions/assert-email@v2
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
