"use client";

import { useState } from "react";
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
  const current = field?.value != null ? String(field.value) : "";

  if (draft !== null) {
    const save = () => {
      if (draft !== current) onSave(draft);
      setDraft(null);
    };
    const shared = { autoFocus: true, "aria-label": `Edit ${label}`, className: "w-full min-w-24 rounded border border-sky-500 px-1 py-0.5" };
    return (
      <td className="px-2 py-1">
        {fieldKey === "assetType" ? (
          <select {...shared} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={save}>
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
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") setDraft(null);
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

  return (
    <td className={`px-2 py-1 ${isDoubtful ? "bg-amber-100" : ""}`}>
      <button
        type="button"
        title={field ? explain(field) : "Empty in the file. Click to add a value."}
        aria-label={`${label}: ${text}${isDoubtful ? ", check this value" : ""}. Click to edit.`}
        onClick={() => setDraft(current)}
        className="w-full rounded px-1 text-left whitespace-nowrap hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-500"
      >
        {isDoubtful && <span aria-hidden="true">⚠ </span>}
        <span className={isUnreadable ? "text-slate-600 italic" : field?.value == null ? "text-slate-400" : ""}>{text}</span>
        {field?.source === "inferred" && <Tag>inferred</Tag>}
        {field?.source === "manual" && <Tag>edited</Tag>}
      </button>
    </td>
  );
}

function Tag({ children }: { children: string }) {
  return <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] tracking-wide text-slate-600 uppercase">{children}</span>;
}
