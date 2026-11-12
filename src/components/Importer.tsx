"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyEdits, NO_EDITS, setColumnTarget, type Edits } from "@/lib/extraction/edits";
import { LIMITS } from "@/lib/extraction/limits";
import { extractAll, planSheet } from "@/lib/extraction/pipeline";
import type { Asset, ColumnTarget, FieldKey, SheetPlan } from "@/lib/extraction/types";
import { SuggestionsSchema } from "@/lib/llm/schema";
import { applySuggestions, buildSuggestRequest, unclearColumns } from "@/lib/llm/suggestions";
import { AiSuggest, type AiStatus } from "./AiSuggest";
import { MappingPanel } from "./MappingPanel";
import { findCurrentPlan, keepChosenColumns } from "./plans";
import { ResultsPanel } from "./ResultsPanel";
import { UploadPanel, type Problem } from "./UploadPanel";

/** An opened file: how each sheet is read, and which sheets are left out. */
interface Loaded {
  /** A new number for every opened file, so the panels start fresh (see the `key` props below). */
  loadId: number;
  fileName: string;
  plans: SheetPlan[];
  excluded: Set<string>;
}

/**
 * The whole app. It holds three pieces of state (the opened file with its plans, the user's
 * manual edits, and the last problem) and derives everything shown from them. All interpreting
 * of spreadsheet data happens in src/lib/extraction; this component only wires it to the screen.
 */
export function Importer({ aiAvailable }: { aiAvailable: boolean }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [edits, setEdits] = useState<Edits>(NO_EDITS);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  /** Sheet name -> where the optional AI suggestion stands for that sheet. */
  const [ai, setAi] = useState<Record<string, AiStatus>>({});
  const lastLoadId = useRef(0);
  // What is on screen right now, for askAi: it waits for the network, and by the time the
  // answer arrives the `loaded` it started with may be out of date.
  const loadedNow = useRef(loaded);
  useEffect(() => {
    loadedNow.current = loaded;
  }, [loaded]);

  // Extraction is a pure function of the plans, so a mapping change just runs it again.
  const extracted = useMemo(() => {
    if (!loaded) return null;
    return extractAll(loaded.plans.filter((plan) => !loaded.excluded.has(plan.sheet.name)));
  }, [loaded]);
  // Manual edits are laid over the extraction, so typing a correction does not re-read the file.
  const result = useMemo(
    () => extracted && { assets: applyEdits(extracted.assets, edits), skipped: extracted.skipped },
    [extracted, edits],
  );

  async function open(fileName: string, read: () => Promise<ArrayBuffer>) {
    setBusy(true);
    setProblem(null);
    try {
      // The spreadsheet parser is the largest part of the app; fetch it only when a file is opened.
      const { readWorkbook } = await import("@/lib/extraction/readWorkbook");
      const sheets = readWorkbook(new Uint8Array(await read()), fileName);
      lastLoadId.current += 1;
      setLoaded({
        loadId: lastLoadId.current,
        fileName,
        plans: sheets.map((sheet) => planSheet(sheet)),
        // Hidden sheets usually hold stale copies; they start left out and can be switched on.
        excluded: new Set(sheets.filter((sheet) => sheet.hidden).map((sheet) => sheet.name)),
      });
      setEdits(NO_EDITS);
      setAi({});
    } catch (error) {
      setLoaded(null);
      setProblem(describe(error));
    } finally {
      setBusy(false);
    }
  }

  function openFile(file: File) {
    if (busy) return; // one file at a time: a second load would race the first for the screen
    if (file.size > LIMITS.fileBytes) {
      // Checked before reading, so a huge file is never loaded into memory.
      // The number comes from the limit itself, so the message cannot go stale when it changes.
      setLoaded(null);
      setProblem({
        message: `This file is larger than ${LIMITS.fileBytes / 1024 / 1024} MB.`,
        hint: "Split it into smaller files, or remove sheets that are not asset lists.",
      });
      return;
    }
    void open(file.name, () => file.arrayBuffer());
  }

  function openSample(file: string) {
    if (busy) return;
    void open(file, async () => {
      const response = await fetch(`/samples/${file}`);
      if (!response.ok) throw new Error(`The sample could not be loaded (HTTP ${response.status}).`);
      return response.arrayBuffer();
    });
  }

  /** Replace the plan of one sheet. */
  const updatePlan = (sheet: string, change: (plan: SheetPlan) => SheetPlan) =>
    setLoaded((current) => current && { ...current, plans: current.plans.map((plan) => (plan.sheet.name === sheet ? change(plan) : plan)) });

  const changeTarget = (sheet: string, columnIndex: number, target: ColumnTarget) =>
    updatePlan(sheet, (plan) => setColumnTarget(plan, columnIndex, target));

  /** Forget where the AI suggestion stands for a sheet, so no message about it stays on screen. */
  const clearAiStatus = (sheet: string) =>
    setAi((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== sheet)));

  function changeHeaderRow(sheet: string, row: number | null | "auto") {
    const before = loaded?.plans.find((plan) => plan.sheet.name === sheet);
    if (!before) return;
    const planned = row === "auto" ? planSheet(before.sheet) : planSheet(before.sheet, row);
    // Same header row as before ("Detect again" found the same one): keep what the user and
    // the AI chose. Another row: the columns mean something else, so start from the rules and
    // drop the AI message, which would now talk about columns that are no longer marked.
    updatePlan(sheet, () => keepChosenColumns(before, planned));
    if (planned.header.rowIndex !== before.header.rowIndex) clearAiStatus(sheet);
  }

  const toggleSheet = (sheet: string) =>
    setLoaded((current) => {
      if (!current) return current;
      const excluded = new Set(current.excluded);
      if (!excluded.delete(sheet)) excluded.add(sheet);
      return { ...current, excluded };
    });

  const editValue = (assetId: string, key: FieldKey, text: string) =>
    setEdits((current) => ({ ...current, values: { ...current.values, [assetId]: { ...current.values[assetId], [key]: text } } }));

  const setKind = (assetId: string, kind: Asset["kind"]) =>
    setEdits((current) => ({ ...current, kinds: { ...current.kinds, [assetId]: kind } }));

  /**
   * Ask the server (and through it, Claude) about the columns the rules left unclear.
   * This is the only request that carries spreadsheet data, and only after a click.
   * On any failure the plan is left exactly as the rules made it.
   *
   * The answer takes a second or more. If meanwhile another file was opened, it is dropped
   * without a word (a message under a file that was never sent would be wrong); if another
   * header row was chosen, the user is told that nothing was changed.
   */
  async function askAi(sheet: string) {
    const plan = loaded?.plans.find((item) => item.sheet.name === sheet);
    if (!plan) return;
    const report = (status: AiStatus) => setAi((current) => ({ ...current, [sheet]: status }));
    report({ state: "asking" });
    try {
      const response = await fetch("/api/suggest-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSuggestRequest(plan)),
      });
      const body: unknown = await response.json().catch(() => null);
      const answer = SuggestionsSchema.safeParse(body);

      const current = findCurrentPlan(loadedNow.current?.plans, plan);
      if (current === "file-changed") return;
      if (current === "header-changed") {
        report({ state: "failed", message: "The sheet changed while waiting. Nothing was changed." });
        return;
      }
      if (!response.ok || !answer.success) {
        const reason = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "The AI suggestion failed.";
        report({ state: "failed", message: `${reason} Nothing was changed.` });
        return;
      }
      const suggestions = answer.data.suggestions;
      // Counted on the plan as it is now, so the message matches what is applied.
      const changed = applySuggestions(current, suggestions).columns.filter((column, position) => column !== current.columns[position]).length;
      // The same check once more inside the update, in case the plan changed in this very moment.
      updatePlan(sheet, (latest) => (findCurrentPlan([latest], plan) === latest ? applySuggestions(latest, suggestions) : latest));
      report({
        state: "done",
        message: changed > 0 ? `AI suggested a field for ${changed} ${changed === 1 ? "column" : "columns"}. They are marked “AI” above: please check them.` : "AI could not identify these columns either. They stay unused.",
      });
    } catch {
      if (findCurrentPlan(loadedNow.current?.plans, plan) === "file-changed") return;
      report({ state: "failed", message: "The AI service could not be reached. Nothing was changed." });
    }
  }

  const assetCounts = new Map<string, number>();
  for (const asset of result?.assets ?? []) assetCounts.set(asset.sheet, (assetCounts.get(asset.sheet) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <UploadPanel busy={busy} problem={problem} onFile={openFile} onSample={openSample} />
      {loaded && result && (
        <>
          <p className="text-sm text-slate-700" aria-live="polite">
            Opened <strong>{loaded.fileName}</strong>: {loaded.plans.length} {loaded.plans.length === 1 ? "sheet" : "sheets"},{" "}
            {result.assets.length} rows extracted.
          </p>
          {/* The key makes React build both panels anew for every opened file, so the chosen tab,
              the "only rows to check" filter, "Show all" and a half-typed cell do not carry over. */}
          <MappingPanel
            key={`mapping-${loaded.loadId}`}
            plans={loaded.plans}
            excluded={loaded.excluded}
            assetCounts={assetCounts}
            onTarget={changeTarget}
            onHeaderRow={changeHeaderRow}
            onToggleSheet={toggleSheet}
            aiControl={
              aiAvailable
                ? (plan) => <AiSuggest unclear={unclearColumns(plan).length} status={ai[plan.sheet.name]} onAsk={() => void askAi(plan.sheet.name)} />
                : undefined
            }
          />
          <ResultsPanel key={`results-${loaded.loadId}`} fileName={loaded.fileName} assets={result.assets} skipped={result.skipped} onEdit={editValue} onKind={setKind} />
        </>
      )}
    </div>
  );
}

/** Turn anything thrown while opening a file into a message and a next step. */
function describe(error: unknown): Problem {
  // UnreadableFileError (see readWorkbook.ts) carries its own hint.
  if (error instanceof Error && "hint" in error && typeof error.hint === "string") {
    return { message: error.message, hint: error.hint };
  }
  const detail = error instanceof Error ? error.message : String(error);
  return {
    message: "Something went wrong while reading this file.",
    hint: `Try again, or save the file as .xlsx or .csv and upload that. (${detail})`,
  };
}
