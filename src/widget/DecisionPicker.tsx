import React, { useMemo, useRef, useState } from "react";
import { useApp, useDocumentTheme, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { NormalizedDecisionDefinition } from "../core/schema.js";
import { conversationMessage, createSelectionPayload, humanSelectionText } from "../core/payload.js";

function RecommendedBadge() {
  return <span className="recommended-badge">Recommended</span>;
}

type Option = NormalizedDecisionDefinition["options"][number];
type LayoutProps = {
  decision: NormalizedDecisionDefinition;
  selectedIds: string[];
  disabled: boolean;
  onOption: (option: Option) => void;
};

function CardsOrListLayout({ decision, selectedIds, disabled, onOption }: LayoutProps) {
  return (
    <div className="options-container">
      {decision.options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={`decision-option ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onOption(option)}
          >
            <span className="option-title-row">
              <strong>{option.title}</strong>
              {option.recommended ? <RecommendedBadge /> : null}
            </span>
            <span className="option-description">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function SegmentedLayout({ decision, selectedIds, disabled, onOption }: LayoutProps) {
  const selected = decision.options.filter((option) => selectedIds.includes(option.id));
  return (
    <div className="segmented-shell" role="group" aria-label={decision.question}>
      <div className="segmented-options">
        {decision.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={isSelected ? "selected" : ""}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onOption(option)}
            >
              <span>{option.title}</span>
              {option.recommended ? <small>Recommended</small> : null}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <p className="segmented-description">
          {selected.map((option) => option.description).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

const LAYOUT_REGISTRY: Record<NormalizedDecisionDefinition["layout"], React.ComponentType<LayoutProps>> = {
  cards: CardsOrListLayout,
  list: CardsOrListLayout,
  segmented: SegmentedLayout
};

export function DecisionPicker() {
  const [decision, setDecision] = useState<NormalizedDecisionDefinition | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  const { app } = useApp({
    onAppCreated: (createdApp) => {
      createdApp.ontoolresult = (result) => {
        const incoming = result.structuredContent as { decision?: NormalizedDecisionDefinition } | undefined;
        setDecision(incoming?.decision ?? null);
        setSelectedIds([]);
        setSubmittedText(null);
        setError(null);
        submitLock.current = false;
      };
    }
  });

  useHostStyles(app, app?.getHostContext());
  useDocumentTheme();

  const selectionValid = useMemo(() => {
    if (!decision) return false;
    if (decision.interactionType === "single_choice") return selectedIds.length === 1;
    return selectedIds.length >= decision.minSelections! && selectedIds.length <= decision.maxSelections!;
  }, [decision, selectedIds]);

  if (submittedText) {
    return <div className="collapsed-result" role="status">{submittedText}</div>;
  }

  if (!decision) {
    return <div className="error-card" role="alert">Unsupported or missing decision schema.</div>;
  }

  const submit = async (ids: string[]) => {
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      setSubmitting(true);
      setError(null);
      const payload = createSelectionPayload(decision, ids);
      if (!app) throw new Error("ChatGPT app host is unavailable.");
      const result = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: conversationMessage(payload) }]
      });
      if (result.isError) throw new Error("ChatGPT did not accept the decision message.");
      setSubmittedText(humanSelectionText(payload));
    } catch (submitError) {
      submitLock.current = false;
      setError(submitError instanceof Error ? submitError.message : "Could not submit decision.");
    } finally {
      setSubmitting(false);
    }
  };

  const chooseSingle = (id: string) => {
    setSelectedIds([id]);
    void submit([id]);
  };

  const toggleMulti = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      if (current.length >= decision.maxSelections!) return current;
      return [...current, id];
    });
  };

  const onOption = (option: Option) => {
    if (decision.interactionType === "single_choice") chooseSingle(option.id);
    else toggleMulti(option.id);
  };

  const Layout = LAYOUT_REGISTRY[decision.layout];
  if (!Layout) {
    return <div className="error-card" role="alert">Unsupported decision layout.</div>;
  }

  return (
    <section className={`decision-picker layout-${decision.layout}`} aria-labelledby="decision-question">
      <header>
        <h2 id="decision-question">{decision.question}</h2>
        {decision.description ? <p>{decision.description}</p> : null}
      </header>

      <Layout decision={decision} selectedIds={selectedIds} disabled={submitting} onOption={onOption} />

      {decision.interactionType === "multi_select" ? (
        <footer>
          <span className="selection-count">
            Select {decision.minSelections}–{decision.maxSelections} · {selectedIds.length} selected
          </span>
          <button
            type="button"
            className="submit-button"
            disabled={!selectionValid || submitting}
            onClick={() => void submit(selectedIds)}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </footer>
      ) : null}

      {error ? <p className="submit-error" role="alert">{error}</p> : null}
    </section>
  );
}
