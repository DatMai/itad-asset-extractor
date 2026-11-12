"use client";

/** Where the optional AI suggestion stands for one sheet. */
export type AiStatus = { state: "asking" } | { state: "done" | "failed"; message: string };

interface Props {
  /** How many columns the rules left unused or flagged. */
  unclear: number;
  status: AiStatus | undefined;
  onAsk: () => void;
}

/**
 * The opt-in "ask AI" control under a sheet's mapping table. It is the only action in the app
 * that sends data out of the browser, so it says exactly what will be sent before the click.
 */
export function AiSuggest({ unclear, status, onAsk }: Props) {
  if (unclear === 0 && !status) return null;
  const columns = unclear === 1 ? "1 unclear column" : `${unclear} unclear columns`;

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      {unclear > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={onAsk}
            disabled={status?.state === "asking"}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-900 hover:border-sky-500 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-50"
          >
            {status?.state === "asking" ? "Asking…" : `Ask AI about the ${columns}`}
          </button>
          <p className="max-w-3xl text-slate-600">
            Sends the names of this sheet’s columns and up to five sample values from the {columns} to Anthropic’s
            API. In a sample value, a word is sent as written only if it is a hardware word (a brand, product line,
            device type, processor family, unit or drive word, such as “Dell”, “Latitude” or “SSD”), a specification
            or a date (such as “16GB” or “i7-1185G7”), or a number of at most four characters (such as the “5420” of
            a model). Every other word, including names, emails, phone numbers, serial numbers and tags, is sent as
            its shape only: each letter becomes A or a, each digit 9. A name that is also a hardware word (such as
            “Swift”, an Acer laptop) is sent as written. Nothing else leaves your browser.
          </p>
        </div>
      )}
      {status && status.state !== "asking" && (
        <p role="status" className={`${unclear > 0 ? "mt-2" : ""} ${status.state === "failed" ? "text-red-800" : "text-slate-700"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
