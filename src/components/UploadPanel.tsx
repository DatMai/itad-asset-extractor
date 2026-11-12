"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/extraction/limits";

/** Files shipped with the app, so the extractor can be tried without a spreadsheet at hand. */
const SAMPLES = [
  { file: "sample_assets_1.xlsx", label: "Client sample 1", detail: "xlsx · header on row 4 · two sheets" },
  { file: "sample_assets_2.csv", label: "Client sample 2", detail: "csv · everything in one description column" },
  { file: "vn_headers_row7.xlsx", label: "Vietnamese headers", detail: "xlsx · header on row 7 · date cells · hidden sheet" },
  { file: "semicolon_abbrev.csv", label: "Abbreviated headers", detail: "csv with ; · decimal commas · title line" },
  { file: "no_header.tsv", label: "No header row", detail: "tab-separated · columns found from values" },
  { file: "one_cell_per_asset.xls", label: "One cell per asset", detail: "xls · free text · non-computers" },
];

export interface Problem {
  message: string;
  hint: string;
}

interface Props {
  busy: boolean;
  problem: Problem | null;
  onFile: (file: File) => void;
  onSample: (file: string) => void;
}

export function UploadPanel({ busy, problem, onFile, onSample }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const megabytes = LIMITS.fileBytes / 1024 / 1024;

  return (
    <section aria-labelledby="upload-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="upload-title" className="text-lg font-semibold">
        1. Upload a spreadsheet
      </h2>

      <label
        onDragOver={(event) => {
          event.preventDefault(); // without this the browser opens the file instead
          if (!busy) setIsDragging(true); // while a file is being read the zone does not invite another
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files[0];
          // The file input and the sample buttons are disabled while reading; a drop must wait too,
          // or two files are read at once and the slower one wins the screen.
          if (file && !busy) onFile(file);
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-6 py-10 text-center transition focus-within:ring-2 focus-within:ring-sky-500 ${
          isDragging ? "border-sky-500 bg-sky-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = ""; // so choosing the same file again fires a change
          }}
        />
        <span className="font-medium text-slate-900">{busy ? "Reading…" : "Drop a file here, or click to choose one"}</span>
        <span className="text-sm text-slate-600">
          .xlsx, .xls or .csv · up to {megabytes} MB and {LIMITS.rows.toLocaleString("en")} rows per sheet
        </span>
        <span className="text-sm text-slate-600">The file is read in this browser tab. It is not uploaded anywhere.</span>
      </label>

      {problem && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-red-900">{problem.message}</p>
          <p className="mt-1 text-red-800">{problem.hint}</p>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-700">No file at hand? Try one of these:</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((sample) => (
            <li key={sample.file}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSample(sample.file)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-50"
              >
                <span className="block font-medium text-slate-900">{sample.label}</span>
                <span className="block text-slate-600">{sample.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
