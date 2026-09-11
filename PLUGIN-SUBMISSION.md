# Plugin Submission Runbook

This file is the operational checklist for submitting **Decision Picker** to the OpenAI Plugins Directory. It is not a release artifact and does not authorize merging this branch.

## Production endpoints

After the submission branch is merged and Railway redeploys the merged commit:

- Website: `https://chatgpt-decision-picker-production.up.railway.app/`
- MCP server: `https://chatgpt-decision-picker-production.up.railway.app/mcp`
- Health: `https://chatgpt-decision-picker-production.up.railway.app/health`
- Privacy: `https://chatgpt-decision-picker-production.up.railway.app/privacy`
- Terms: `https://chatgpt-decision-picker-production.up.railway.app/terms`
- Support: `https://chatgpt-decision-picker-production.up.railway.app/support`
- Domain challenge: `https://chatgpt-decision-picker-production.up.railway.app/.well-known/openai-apps-challenge`

Authentication: **None** for v1. The server is public and stateless.

## Plugin package

Repository package metadata lives in:

- `.codex-plugin/plugin.json`
- `chatgpt-app-submission.json`

The plugin manifest intentionally does not invent a registered ChatGPT app ID. The public MCP URL is supplied directly in the OpenAI submission portal.

## App listing copy

- Display name: `Decision Picker`
- Subtitle: `Clickable decisions in chat`
- Category: `PRODUCTIVITY`
- Short description: Turn explicit choices into clickable single-choice or bounded multi-select controls inside a conversation.
- Website: production root URL above
- Support URL: `/support`
- Privacy policy URL: `/privacy`
- Terms URL: `/terms`

Suggested starter prompts:

1. `Help me choose between these options with a clickable decision picker.`
2. `Show these alternatives as cards and mark the best default as recommended.`
3. `Let me select exactly two priorities from this list and submit them together.`
4. `Give me a compact segmented choice for these three options.`

Release notes for the first public submission:

> Initial public release of Decision Picker with single-choice and bounded multi-select interactions, cards/list/segmented layouts, recommended-option badges, final structured selection payloads, and fail-closed schema validation.

## Tool review

Exposed tool: `decision_picker`

Annotations:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`

The tool validates and renders user-visible decision data. It does not mutate third-party systems. The user's eventual click is sent back to their ChatGPT conversation by the widget; it does not execute the selected real-world action.

The tool declares an `outputSchema` matching `structuredContent.decision`.

## Widget security

The widget is built as a single self-contained HTML resource. Its submitted resource metadata uses a deny-by-default CSP:

- `connectDomains: []`
- `resourceDomains: []`
- no frame domains
- dedicated widget domain: `https://chatgpt-decision-picker-production.up.railway.app`

No remote scripts, stylesheets, images, frames, analytics, or widget-side network requests are required.

## Domain verification

When the OpenAI submission portal generates a domain-verification token:

1. Set Railway service variable `OPENAI_APPS_CHALLENGE_TOKEN` to the exact token.
2. Redeploy or restart if Railway does not automatically roll the variable change.
3. Verify that `/.well-known/openai-apps-challenge` returns only the exact token as `text/plain`.
4. Complete verification in the submission portal.
5. Keep the variable until review/publishing no longer requires the challenge endpoint.

If the variable is absent, the challenge endpoint intentionally returns HTTP 404.

## Submission file

Upload `chatgpt-app-submission.json` in the Apps/plugin submission flow. It contains:

- app info suggestions;
- the exact `decision_picker` annotation values and review justifications;
- exactly 5 positive test cases;
- exactly 3 negative test cases.

After importing it, use **Scan Tools** against the production MCP endpoint and confirm the discovered descriptor matches the repository source before submitting.

## External prerequisites / blockers

These are not represented as code and must be completed in the OpenAI submission portal/account:

- developer/business identity verification;
- organization permission that allows app/plugin management writes;
- a production-ready plugin logo uploaded to the listing;
- domain verification using the challenge token;
- final policy attestations and submission review.

The repository does **not** generate or substitute a logo automatically. A visual asset should be explicitly approved before it becomes submission authority.

## Promotion gate

Do not submit the production endpoint until all of these are true:

1. This branch is reviewed and intentionally merged.
2. GitHub CI is green on the exact merged commit.
3. Railway reports `SUCCESS` for that exact commit.
4. `/health`, `/privacy`, `/terms`, `/support`, and the MCP tool scan work on the production domain.
5. Domain challenge is verified.
6. Listing logo and account-level verification requirements are complete.
