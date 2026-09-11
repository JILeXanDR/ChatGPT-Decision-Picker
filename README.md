# ChatGPT Decision Picker

Reusable inline decision widgets for ChatGPT Apps SDK conversations.

The app renders typed decisions directly inside ChatGPT. A user clicks an option instead of typing a reply. The widget then sends both a human-readable selection and a machine-readable payload back into the conversation and collapses to a short final result.

## v1 contract

- `schemaVersion: 1` is required; unknown versions fail closed.
- `interactionType`: `single_choice` or `multi_select`.
- `layout`: `cards`, `list`, or `segmented`.
- Interaction semantics and visual layout are independent.
- `question` is required; `description` is optional.
- Every option requires `id`, `value`, `title`, and `description`.
- `Recommended` is a visual hint only. It never preselects an option.
- `single_choice` permits at most one recommended option and submits immediately on click.
- `multi_select` permits multiple recommended options, requires `minSelections` and `maxSelections`, and submits only through an explicit **Submit** action.
- A successful submission is final. The widget collapses to `Selected: …` and does not expose Change/Undo.
- The conversation receives readable text plus `DECISION_PAYLOAD` JSON with duplicated option metadata.
- Unknown interaction types/layouts fail closed; the renderer does not guess.

## Example

```json
{
  "schemaVersion": 1,
  "decisionId": "match-setup.start-slot-policy",
  "interactionType": "single_choice",
  "layout": "cards",
  "question": "How should start slots be assigned?",
  "description": "Choose the canonical assignment policy.",
  "options": [
    {
      "id": "fixed",
      "value": "FIXED",
      "title": "Fixed positions",
      "description": "Each participant keeps an authored StartSlot assignment."
    },
    {
      "id": "deterministic-random",
      "value": "DETERMINISTIC_RANDOM",
      "title": "Deterministic Random",
      "description": "The server deterministically permutes eligible StartSlots before match freeze.",
      "recommended": true
    }
  ]
}
```

If `decisionId` is omitted, the server generates a deterministic ID from the stable decision content.

## Conversation payload

A successful selection sends one visible user message shaped like:

```text
Selected: Deterministic Random

DECISION_PAYLOAD {"schemaVersion":1,"event":"decision_submitted",...}
```

This keeps the transcript understandable to a human while giving the model a stable machine-readable record.

## Architecture

```text
ChatGPT / model
  -> decision_picker MCP tool
  -> schema validation + normalization
  -> structuredContent.decision
  -> ui://decision-picker/widget.html
  -> inline React widget
  -> user selection
  -> app.sendMessage(...)
  -> human text + DECISION_PAYLOAD
```

The widget is bundled into a single self-contained HTML file and registered with `registerAppResource`. The tool is registered with `registerAppTool` and `_meta.ui.resourceUri`, following the current MCP Apps pattern; the widget uses `app.sendMessage(...)` to submit the final selection back to the conversation.

## Local development

Requirements: Node.js 22+.

```bash
npm install
npm test
npm run build
npm start
```

The server uses stateless Streamable HTTP. The MCP endpoint is then available at:

```text
http://localhost:8000/mcp
```

For ChatGPT integration, expose the MCP endpoint over HTTPS using your normal development tunnel/deployment and connect that endpoint as a ChatGPT App/MCP integration supported by your account.

## Files

- `schema/decision-picker.schema.json` — public v1 JSON schema.
- `src/core/schema.ts` — fail-closed semantic validation and normalization.
- `src/core/payload.ts` — stable submitted payload and human-readable message.
- `src/widget/DecisionPicker.tsx` — inline renderer/interaction engine.
- `src/server.ts` — MCP tool + widget resource.
- `examples/` — single-choice and multi-select examples.
- `tests/` — dependency-free core contract tests.

## Current verification boundary

Core schema/payload tests can run without third-party packages after TypeScript compilation. A full widget/server build additionally requires the declared npm dependencies. The repository intentionally treats dependency/API mismatch as a build failure rather than silently falling back.
