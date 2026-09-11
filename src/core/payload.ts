import type { NormalizedDecisionDefinition } from "./schema.js";

export interface DecisionSelectionPayload {
  schemaVersion: 1;
  event: "decision_submitted";
  decisionId: string;
  interactionType: NormalizedDecisionDefinition["interactionType"];
  layout: NormalizedDecisionDefinition["layout"];
  question: string;
  description?: string;
  selections: Array<{
    optionId: string;
    value: string;
    title: string;
    description: string;
    recommended: boolean;
  }>;
}

export function createSelectionPayload(
  decision: NormalizedDecisionDefinition,
  optionIds: string[]
): DecisionSelectionPayload {
  const selected = optionIds.map((id) => {
    const option = decision.options.find((candidate) => candidate.id === id);
    if (!option) throw new Error(`Unknown option id: ${id}`);
    return {
      optionId: option.id,
      value: option.value,
      title: option.title,
      description: option.description,
      recommended: option.recommended === true
    };
  });

  if (decision.interactionType === "single_choice" && selected.length !== 1) {
    throw new Error("single_choice requires exactly one selection");
  }
  if (decision.interactionType === "multi_select") {
    const min = decision.minSelections!;
    const max = decision.maxSelections!;
    if (selected.length < min || selected.length > max) {
      throw new Error(`multi_select requires ${min}..${max} selections`);
    }
  }

  return {
    schemaVersion: 1,
    event: "decision_submitted",
    decisionId: decision.decisionId,
    interactionType: decision.interactionType,
    layout: decision.layout,
    question: decision.question,
    description: decision.description,
    selections: selected
  };
}

export function humanSelectionText(payload: DecisionSelectionPayload): string {
  const labels = payload.selections.map((selection) => selection.title);
  return `Selected: ${labels.join(", ")}`;
}

export function conversationMessage(payload: DecisionSelectionPayload): string {
  return `${humanSelectionText(payload)}\n\nDECISION_PAYLOAD ${JSON.stringify(payload)}`;
}
