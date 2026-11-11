"use client";

import { useState } from "react";
import { COMBINED, FIELDS } from "@/lib/extraction/fields";
import { columnLetter } from "@/lib/extraction/mapColumns";
import { FIELD_KEYS, LOW_CONFIDENCE, type ColumnMapping, type ColumnTarget, type SheetPlan } from "@/lib/extraction/types";
import { LEVEL_LABEL, LEVEL_STYLE, levelOf } from "./format";

interface Props {
  plans: SheetPlan[];
  /** Names of the sheets left out of the results. */
  excluded: Set<string>;
  /** Sheet name -> number of assets found in it. */
  assetCounts: Map<string, number>;
  onTarget: (sheet: string, columnIndex: number, target: ColumnTarget) => void;
  /** A row index, null for "no header row", or "auto" to detect it again. */
  onHeaderRow: (sheet: string, row: number | null | "auto") => void;
  onToggleSheet: (sheet: string) => void;
  /** Renders the optional "ask AI" control for a sheet, when the server has an API key. */
  aiControl?: (plan: SheetPlan) => React.ReactNode;
}

export function MappingPanel({ plans, excluded, assetCounts, onTarget, onHeaderRow, onToggleSheet, aiControl }: Props) {
  return (
    <section aria-labelledby="mapping-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="mapping-title" className="text-lg font-semibold">
        2. Check how the columns were read
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Each column was matched to a field from its name and from its values. Change anything that is wrong: the
        results below update straight away.
      </p>

      <div className="mt-4 space-y-4">
        {plans.map((plan) => (
          <SheetCard
            key={plan.sheet.name}
            plan={plan}
            included={!excluded.has(plan.sheet.name)}
            assetCount={assetCounts.get(plan.sheet.name) ?? 0}
            onTarget={(columnIndex, target) => onTarget(plan.sheet.name, columnIndex, target)}
            onHeaderRow={(row) => onHeaderRow(plan.sheet.name, row)}
            onToggle={() => onToggleSheet(plan.sheet.name)}
            aiControl={aiControl?.(plan)}
          />
        ))}
      </div>
    </section>
  );
}

interface SheetCardProps {
  plan: SheetPlan;
  included: boolean;
  assetCount: number;
  onTarget: (columnIndex: number, target: ColumnTarget) => void;
  onHeaderRow: (row: number | null | "auto") => void;
  onToggle: () => void;
  aiControl?: React.ReactNode;
}

function SheetCard({ plan, included, assetCount, onTarget, onHeaderRow, onToggle, aiControl }: SheetCardProps) {
  const { sheet, header, columns } = plan;
  const used = columns.filter((column) => column.target !== "ignore");
  const toCheck = used.filter((column) => column.confidence < LOW_CONFIDENCE).length;
  const headerId = `header-row-${sheet.name}`;
  // React would re-open a <details> on every render if "open" were fixed, so the user's choice is kept in state.
  const [showColumns, setShowColumns] = useState(true);

  // The rows a user could pick as the header: the first 30 that contain anything.
  const candidateRows = sheet.rows
    .map((row, index) => ({ index, text: row.filter((cell) => cell !== "").join(" | ") }))
    .filter((row) => row.text !== "")
    .slice(0, 30);

  return (
    <article className={`rounded-lg border border-slate-200 ${included ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{sheet.name}</h3>
        {sheet.hidden && <Badge>hidden sheet</Badge>}
        <span className="text-sm text-slate-600">
          {included ? `${assetCount} ${assetCount === 1 ? "row" : "rows"} extracted` : "left out"}
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={included} onChange={onToggle} className="size-4 accent-sky-600" />
          Include this sheet
        </label>
      </div>

      <div className="space-y-3 px-4 py-3">
        {sheet.truncated && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠ {sheet.truncated}</p>}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <label htmlFor={headerId} className="font-medium text-slate-700">
            Header row
          </label>
          <select
            id={headerId}
            value={header.rowIndex ?? "none"}
            onChange={(event) => onHeaderRow(event.target.value === "none" ? null : Number(event.target.value))}
            className="max-w-full rounded-md border border-slate-300 bg-white px-2 py-1 sm:max-w-md"
          >
            <option value="none">No header row</option>
            {candidateRows.map((row) => (
              <option key={row.index} value={row.index}>
                Row {row.index + 1}: {row.text.slice(0, 60)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onHeaderRow("auto")} className="text-sky-700 underline hover:text-sky-900">
            Detect again
          </button>
          <span className="text-slate-600">{header.reason}</span>
        </div>

        {columns.length === 0 ? (
          <p className="text-sm text-slate-600">This sheet has no columns to read.</p>
        ) : (
          <details open={showColumns} onToggle={(event) => setShowColumns(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700 select-none">
              {used.length} of {columns.length} columns used
              {toCheck > 0 && <span className="ml-2 text-amber-800">· ⚠ {toCheck} to check</span>}
            </summary>
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">Column in the file</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Sample values</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Read as</th>
                    <th scope="col" className="py-1 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columns.map((column) => (
                    <ColumnRow key={column.index} sheetName={sheet.name} column={column} onTarget={(target) => onTarget(column.index, target)} />
                  ))}
                </tbody>
              </table>
            </div>
            {aiControl}
          </details>
        )}
      </div>
    </article>
  );
}

function ColumnRow({ sheetName, column, onTarget }: { sheetName: string; column: ColumnMapping; onTarget: (target: ColumnTarget) => void }) {
  const selectId = `target-${sheetName}-${column.index}`;
  const needsCheck = column.target !== "ignore" && column.confidence < LOW_CONFIDENCE;

  return (
    <tr className={needsCheck ? "bg-amber-50" : undefined}>
      <td className="py-2 pr-3 align-top">
        <label htmlFor={selectId} className="font-medium text-slate-900">
          <span className="mr-2 inline-block w-6 rounded bg-slate-100 text-center text-xs text-slate-600">{columnLetter(column.index)}</span>
          {column.header}
        </label>
      </td>
      <td className="max-w-xs py-2 pr-3 align-top text-slate-600">
        {column.samples.length > 0 ? column.samples.map((sample) => sample.slice(0, 40)).join(" · ") : "(empty)"}
      </td>
      <td className="py-2 pr-3 align-top">
        <select
          id={selectId}
          value={column.target}
          onChange={(event) => onTarget(event.target.value as ColumnTarget)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1"
        >
          <optgroup label="Fields">
            {FIELD_KEYS.map((key) => (
              <option key={key} value={key}>
                {FIELDS[key].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other">
            <option value="combined">{COMBINED.label}</option>
            <option value="ignore">Not used</option>
          </optgroup>
        </select>
      </td>
      <td className="py-2 align-top">
        <ConfidenceChip column={column} />
        <span className="ml-2 text-slate-600">{column.reason}</span>
      </td>
    </tr>
  );
}

/** A named level first, the number second: people over-trust bare percentages. */
function ConfidenceChip({ column }: { column: ColumnMapping }) {
  if (column.target === "ignore") return <Badge>Not used</Badge>;
  if (column.source === "you") return <Badge>Set by you</Badge>;
  const level = levelOf(column.confidence);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${LEVEL_STYLE[level]}`}>
      {level === "check" && <span aria-hidden="true">⚠&nbsp;</span>}
      {column.source === "ai" && "AI · "}
      {LEVEL_LABEL[level]} · {Math.round(column.confidence * 100)}%
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ring-inset">
      {children}
    </span>
  );
}
