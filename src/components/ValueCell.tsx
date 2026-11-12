"use client";

import { useId, useRef, useState } from "react";
import { ASSET_TYPES, LOW_CONFIDENCE, type FieldKey, type FieldValue } from "@/lib/extraction/types";
import { explain, formatValue } from "./format";

interface Props {
  fieldKey: FieldKey;
  /** The column title, for screen readers. */
  label: string;
  field: FieldValue | undefined;
  /** Called with the text the user typed; "" clears the value. */
  onSave: (text: string) => void;
}

/** One value in the results table. Click to edit; hover to see where the value came from. */
export function ValueCell({ fieldKey, label, field, onSave }: Props) {
  // null while the cell is shown; the text being typed while it is edited.
  const [draft, setDraft] = useState<string | null>(null);
  // True when editing ended on the keyboard: the cell button then takes the focus as it reappears.
  const [focusCell, setFocusCell] = useState(false);
  // Some browsers send a last "blur" to an editor that is being removed. Without this flag that
  // blur would save a text the user had just cancelled with Escape.
  const closed = useRef(false);
  const current = field?.value != null ? String(field.value) : "";
  const explanationId = useId();

  function open() {
    closed.current = false;
    setDraft(current);
  }

  /** Leave the editor. `text` is what to save, or null to cancel. */
  function close(text: string | null, backToCell: boolean) {
    if (closed.current) return;
    closed.current = true;
    if (text !== null && text !== current) onSave(text);
    setFocusCell(backToCell);
    setDraft(null);
  }

  if (draft !== null) {
    const shared = {
      autoFocus: true,
      "aria-label": `Edit ${label}`,
      className: "w-full min-w-24 rounded border border-sky-500 px-1 py-0.5",
      // Clicking or tabbing away keeps what was typed. The focus is already where the user put it.
      onBlur: () => close(draft, false),
    };
    return (
      <td className="px-2 py-1">
        {fieldKey === "assetType" ? (
          // A dropdown has nothing to type, so choosing is saving.
          <select {...shared} value={draft} onChange={(event) => close(event.target.value, true)}>
            <option value="">(none)</option>
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...shared}
            value={draft}
            onFocus={(event) => event.target.select()} // typing replaces the old value
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== "Escape") return;
              // The cell button takes the focus while this key is still down. Without this, the
              // same key press would "click" that button and open the editor again.
              event.preventDefault();
              close(event.key === "Enter" ? draft : null, true);
            }}
          />
        )}
      </td>
    );
  }

  // Doubtful: a value we are unsure of, or text in the file that we could not read.
  const isDoubtful = field !== undefined && field.confidence < LOW_CONFIDENCE;
  const isUnreadable = isDoubtful && field.value === null;
  const text = field?.value != null ? formatValue(fieldKey, field.value) : isUnreadable && field.raw ? field.raw : "—";
  const explanation = field ? explain(field) : "Empty in the file. Click to add a value.";

  return (
    <td className={`px-2 py-1 ${isDoubtful ? "bg-amber-100" : ""}`}>
      <button
        type="button"
        // The button is drawn anew each time the editor closes, so this runs once per edit. Without
        // it the focus of a keyboard user would fall back to the top of the page.
        autoFocus={focusCell}
        title={explanation}
        aria-label={`${label}: ${text}${isDoubtful ? ", check this value" : ""}. Click to edit.`}
        aria-describedby={explanationId}
        onClick={open}
        className="w-full rounded px-1 text-left whitespace-nowrap hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-500"
      >
        {isDoubtful && <span aria-hidden="true">⚠ </span>}
        <span className={isUnreadable ? "text-slate-600 italic" : field?.value == null ? "text-slate-400" : ""}>{text}</span>
        {field?.source === "inferred" && <Tag>inferred</Tag>}
        {field?.source === "manual" && <Tag>edited</Tag>}
      </button>
      {/* The hover text again, for screen readers: a tooltip is not read out and needs a mouse. */}
      <span id={explanationId} className="sr-only">
        {explanation}
      </span>
    </td>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] tracking-wide text-slate-600 uppercase">{children}</span>;
}
