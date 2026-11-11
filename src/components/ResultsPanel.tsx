"use client";

import { useState } from "react";
import { needsReview, toCsv, toExportRows, toJson } from "@/lib/extraction/exportAssets";
import { FIELDS } from "@/lib/extraction/fields";
import { FIELD_KEYS, type Asset, type FieldKey, type SkippedRow } from "@/lib/extraction/types";
import { ValueCell } from "./ValueCell";

/** The eight facts the brief asks for are always shown; the bonus ones only when the file has them. */
const CORE_FIELDS = FIELD_KEYS.slice(0, 8);
const BONUS_FIELDS = FIELD_KEYS.slice(8);

type Tab = "computers" | "others" | "skipped";

/** Rows drawn at first. A table of thousands of editable cells makes the page sluggish. */
const ROWS_SHOWN_AT_FIRST = 200;

interface Props {
  fileName: string;
  assets: Asset[];
  skipped: SkippedRow[];
  onEdit: (assetId: string, key: FieldKey, text: string) => void;
  onKind: (assetId: string, kind: Asset["kind"]) => void;
}

export function ResultsPanel({ fileName, assets, skipped, onEdit, onKind }: Props) {
  const [tab, setTab] = useState<Tab>("computers");
  const [onlyToCheck, setOnlyToCheck] = useState(false);

  const computers = assets.filter((asset) => asset.kind === "computer");
  const others = assets.filter((asset) => asset.kind === "not-a-computer");
  const toCheck = computers.filter(needsReview);
  const shown = tab === "others" ? others : onlyToCheck ? toCheck : computers;

  const exportName = fileName.replace(/\.[^.]+$/, "") + "-assets";
  const exportRows = () => toExportRows(computers);

  return (
    <section aria-labelledby="results-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 id="results-title" className="text-lg font-semibold">
            3. Review the result
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <span className="rounded bg-amber-100 px-1">⚠ Yellow</span> marks a value to check. Hover a cell to see the
            original text and why; click it to correct it.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <ExportButton disabled={computers.length === 0} onClick={() => download(`${exportName}.csv`, "﻿" + toCsv(exportRows()), "text/csv")}>
            Download CSV
          </ExportButton>
          <ExportButton disabled={computers.length === 0} onClick={() => download(`${exportName}.json`, toJson(exportRows()), "application/json")}>
            Download JSON
          </ExportButton>
        </div>
      </div>

      <TypeSummary computers={computers} />

      <div role="group" aria-label="Which rows to show" className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        <TabButton active={tab === "computers"} onClick={() => setTab("computers")}>Computers ({computers.length})</TabButton>
        <TabButton active={tab === "others"} onClick={() => setTab("others")}>Not computers ({others.length})</TabButton>
        <TabButton active={tab === "skipped"} onClick={() => setTab("skipped")}>Skipped rows ({skipped.length})</TabButton>
      </div>

      {tab === "computers" && (
        <label className="mt-3 flex w-fit items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyToCheck} onChange={(event) => setOnlyToCheck(event.target.checked)} className="size-4 accent-sky-600" />
          Only rows to check ({toCheck.length})
        </label>
      )}

      {tab === "skipped" ? (
        <SkippedTable rows={skipped} />
      ) : shown.length === 0 ? (
        <EmptyState tab={tab} onlyToCheck={onlyToCheck} />
      ) : (
        <AssetTable assets={shown} tab={tab} onEdit={onEdit} onKind={onKind} />
      )}
    </section>
  );
}

function AssetTable({ assets, tab, onEdit, onKind }: { assets: Asset[]; tab: Tab; onEdit: Props["onEdit"]; onKind: Props["onKind"] }) {
  const [showAll, setShowAll] = useState(false);
  const bonus = BONUS_FIELDS.filter((key) => assets.some((asset) => asset.fields[key] !== undefined));
  const columns = [...CORE_FIELDS, ...bonus];
  const hasSeveralSheets = new Set(assets.map((asset) => asset.sheet)).size > 1;
  const visible = showAll ? assets : assets.slice(0, ROWS_SHOWN_AT_FIRST);

  return (
    <>
      <div className="relative mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Extracted assets</caption>
          <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Source</th>
              {tab === "others" && <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Looks like</th>}
              {columns.map((key) => (
                <th key={key} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  {FIELDS[key].label}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">Remarks</th>
              <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50">
                <td className="px-3 py-1 whitespace-nowrap text-slate-600">
                  {hasSeveralSheets && `${asset.sheet} · `}row {asset.rowNumber}
                </td>
                {tab === "others" && <td className="px-3 py-1 whitespace-nowrap">{asset.kindReason}</td>}
                {columns.map((key) => (
                  <ValueCell key={key} fieldKey={key} label={FIELDS[key].label} field={asset.fields[key]} onSave={(text) => onEdit(asset.id, key, text)} />
                ))}
                <td className="max-w-xs px-3 py-1 text-slate-700">
                  {asset.warnings.map((warning) => (
                    <span key={warning} className="mr-2 text-amber-800">
                      ⚠ {warning}
                    </span>
                  ))}
                  {Object.entries(asset.extras).map(([header, value]) => (
                    <span key={header} className="mr-2 whitespace-nowrap text-slate-500" title="A column that is not mapped to a field">
                      {header}: {value}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-1 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onKind(asset.id, tab === "others" ? "computer" : "not-a-computer")}
                    className="text-xs text-sky-700 underline hover:text-sky-900"
                  >
                    {tab === "others" ? "It is a computer" : "Not a computer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length < assets.length && (
        <p className="mt-2 text-sm text-slate-700">
          Showing the first {visible.length} of {assets.length} rows.{" "}
          <button type="button" onClick={() => setShowAll(true)} className="text-sky-700 underline hover:text-sky-900">
            Show all
          </button>{" "}
          (the downloads always contain every row)
        </p>
      )}
    </>
  );
}

function SkippedTable({ rows }: { rows: SkippedRow[] }) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-slate-600">No rows were skipped.</p>;
  return (
    <div className="relative mt-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Rows that were left out, and why</caption>
        <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Source</th>
            <th scope="col" className="px-3 py-2 font-medium">Why it was left out</th>
            <th scope="col" className="px-3 py-2 font-medium">What the row says</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.sheet}#${row.rowNumber}`}>
              <td className="px-3 py-1 whitespace-nowrap text-slate-600">
                {row.sheet} · row {row.rowNumber}
              </td>
              <td className="px-3 py-1">{row.reason}</td>
              <td className="px-3 py-1 text-slate-600">{row.preview}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ tab, onlyToCheck }: { tab: Tab; onlyToCheck: boolean }) {
  if (tab === "others") return <p className="mt-4 text-sm text-slate-600">Nothing was set aside as a non-computer.</p>;
  if (onlyToCheck) return <p className="mt-4 text-sm text-slate-600">Nothing to check: every value was read with confidence.</p>;
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">No assets were found.</p>
      <p className="mt-1">
        In step 2, check that the header row is right and that at least one column is read as a model, a serial number
        or a combined description. If the file has no header row, choose “No header row”.
      </p>
    </div>
  );
}

/** How many computers of each type, as a quick sanity check of the whole file. */
function TypeSummary({ computers }: { computers: Asset[] }) {
  const counts = new Map<string, number>();
  for (const asset of computers) {
    const type = String(asset.fields.assetType?.value ?? "type unknown");
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-sm">
      {[...counts].map(([type, count]) => (
        <li key={type} className="rounded-full bg-slate-100 px-3 py-0.5 text-slate-700">
          {count} {type}
        </li>
      ))}
    </ul>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-500 ${
        active ? "border-sky-600 text-sky-800" : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function ExportButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Hand a generated file to the browser's download manager. Nothing is sent to a server. */
function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
