import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeDecision, validateDecision } from "../.test-build/schema.js";
import { conversationMessage, createSelectionPayload } from "../.test-build/payload.js";

const load = async (name) => JSON.parse(await readFile(new URL(`../examples/${name}`, import.meta.url), "utf8"));

test("single choice example validates and normalizes", async () => {
  const raw = await load("single-choice.json");
  assert.deepEqual(validateDecision(raw), { ok: true, errors: [] });
  const d = normalizeDecision(raw);
  assert.equal(d.decisionId, "match-setup.start-slot-policy");
});

test("single choice rejects more than one recommended option", async () => {
  const raw = await load("single-choice.json");
  raw.options[0].recommended = true;
  const result = validateDecision(raw);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /at most one recommended/i);
});

test("multi select requires explicit bounds", async () => {
  const raw = await load("multi-select.json");
  delete raw.maxSelections;
  const result = validateDecision(raw);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /requires integer minSelections and maxSelections/i);
});

test("unknown layout fails closed", async () => {
  const raw = await load("single-choice.json");
  raw.layout = "carousel";
  const result = validateDecision(raw);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /unsupported layout/i);
});

test("payload duplicates user-readable option metadata", async () => {
  const raw = await load("single-choice.json");
  const d = normalizeDecision(raw);
  const payload = createSelectionPayload(d, ["deterministic-random"]);
  assert.equal(payload.selections[0].title, "Deterministic Random");
  assert.match(payload.selections[0].description, /deterministically permutes/);
  assert.equal(payload.selections[0].recommended, true);
  assert.match(conversationMessage(payload), /^Selected: Deterministic Random/);
  assert.match(conversationMessage(payload), /DECISION_PAYLOAD/);
});

test("decisionId is deterministically generated when omitted", async () => {
  const raw = await load("single-choice.json");
  delete raw.decisionId;
  const a = normalizeDecision(raw).decisionId;
  const b = normalizeDecision(raw).decisionId;
  assert.equal(a, b);
  assert.match(a, /^decision-[0-9a-f]{16}$/);
});
