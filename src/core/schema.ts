export const SCHEMA_VERSION = 1 as const;
export const INTERACTION_TYPES = ["single_choice", "multi_select"] as const;
export const LAYOUTS = ["cards", "list", "segmented"] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];
export type Layout = (typeof LAYOUTS)[number];

export interface DecisionOption {
  id: string;
  value: string;
  title: string;
  description: string;
  recommended?: boolean;
}

export interface DecisionDefinition {
  schemaVersion: 1;
  decisionId?: string;
  interactionType: InteractionType;
  layout: Layout;
  question: string;
  description?: string;
  options: DecisionOption[];
  minSelections?: number;
  maxSelections?: number;
}

export interface NormalizedDecisionDefinition extends Omit<DecisionDefinition, "decisionId"> {
  decisionId: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function deterministicDecisionId(decision: DecisionDefinition): string {
  const identity = JSON.stringify({
    schemaVersion: decision.schemaVersion,
    interactionType: decision.interactionType,
    question: decision.question,
    options: decision.options.map(({ id, value, title }) => ({ id, value, title }))
  });
  // FNV-1a 64-bit is sufficient here: this is a deterministic local identifier,
  // not a security/content-integrity hash. Explicit decisionId remains preferred.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const ch of new TextEncoder().encode(identity)) {
    hash ^= BigInt(ch);
    hash = (hash * prime) & mask;
  }
  return `decision-${hash.toString(16).padStart(16, "0")}`;
}

export function validateDecision(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["decision must be an object"] };
  }

  const d = value as Record<string, unknown>;
  if (d.schemaVersion !== SCHEMA_VERSION) errors.push("unsupported schemaVersion");
  if (!INTERACTION_TYPES.includes(d.interactionType as InteractionType)) errors.push("unsupported interactionType");
  if (!LAYOUTS.includes(d.layout as Layout)) errors.push("unsupported layout");
  if (!nonEmpty(d.question)) errors.push("question is required");
  if (d.description !== undefined && typeof d.description !== "string") errors.push("description must be a string");
  if (d.decisionId !== undefined && !nonEmpty(d.decisionId)) errors.push("decisionId must be a non-empty string when provided");

  if (!Array.isArray(d.options) || d.options.length < 2) {
    errors.push("at least two options are required");
  } else {
    const ids = new Set<string>();
    const values = new Set<string>();
    let recommendedCount = 0;

    d.options.forEach((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push(`options[${index}] must be an object`);
        return;
      }
      const option = raw as Record<string, unknown>;
      if (!nonEmpty(option.id)) errors.push(`options[${index}].id is required`);
      if (!nonEmpty(option.value)) errors.push(`options[${index}].value is required`);
      if (!nonEmpty(option.title)) errors.push(`options[${index}].title is required`);
      if (!nonEmpty(option.description)) errors.push(`options[${index}].description is required`);
      if (option.recommended !== undefined && typeof option.recommended !== "boolean") {
        errors.push(`options[${index}].recommended must be boolean`);
      }
      if (option.recommended === true) recommendedCount += 1;
      if (nonEmpty(option.id)) {
        if (ids.has(option.id)) errors.push(`duplicate option id: ${option.id}`);
        ids.add(option.id);
      }
      if (nonEmpty(option.value)) {
        if (values.has(option.value)) errors.push(`duplicate option value: ${option.value}`);
        values.add(option.value);
      }
    });

    if (d.interactionType === "single_choice") {
      if (recommendedCount > 1) errors.push("single_choice allows at most one recommended option");
      if (d.minSelections !== undefined || d.maxSelections !== undefined) {
        errors.push("single_choice must not define minSelections/maxSelections");
      }
    }

    if (d.interactionType === "multi_select") {
      const min = d.minSelections;
      const max = d.maxSelections;
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        errors.push("multi_select requires integer minSelections and maxSelections");
      } else if ((min as number) < 1 || (max as number) < (min as number) || (max as number) > d.options.length) {
        errors.push("multi_select selection bounds are invalid");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function normalizeDecision(decision: DecisionDefinition): NormalizedDecisionDefinition {
  const validation = validateDecision(decision);
  if (!validation.ok) throw new Error(`Invalid decision schema: ${validation.errors.join("; ")}`);
  return {
    ...decision,
    decisionId: decision.decisionId?.trim() || deterministicDecisionId(decision),
    question: decision.question.trim(),
    description: decision.description?.trim(),
    options: decision.options.map((option) => ({
      ...option,
      id: option.id.trim(),
      value: option.value.trim(),
      title: option.title.trim(),
      description: option.description.trim(),
      recommended: option.recommended === true
    }))
  };
}
