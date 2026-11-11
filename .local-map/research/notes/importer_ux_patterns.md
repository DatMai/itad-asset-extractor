# Importer UX patterns: upload, map, review (state as of November 2026)

## 1. How do Flatfile, OneSchema, CSVBox, Dromo and open-source importers structure the flow?

### Takeaway
One shared spine: upload → header row → map columns → (map values) → review and fix → submit. Steps auto-skip when the system resolves them confidently.

### Cited Findings
- Step lists: OneSchema upload, header row, map, review ([pane 2](https://docs.oneschema.co/docs/2-select-header-row), [pane 4](https://docs.oneschema.co/docs/4-review-finalize)); Flatfile upload or typed entry, sheet, map, enum values, review ([support](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview), updated about a year ago); Dromo upload, header, match, value-fix only when needed, review ([changelog](https://developer.dromo.io/changelog.md), [settings](https://developer.dromo.io/settings/)); CSVBox upload, header, map, verify, submit ([docs export](https://help.csvbox.io/llms-full.txt)); react-spreadsheet-import (RSI) adds sheet selection ([README](https://github.com/UgnisSoftware/react-spreadsheet-import)); TableFlow upload, header, map ([README](https://github.com/tableflowhq/csv-import)).
- Auto-skip: Dromo skips matching when all headers match exactly ([changelog](https://developer.dromo.io/changelog.md)); CSVBox can skip mapping on exact match and verify when error-free ([docs export](https://help.csvbox.io/llms-full.txt)).

### Inferences
- Three steps is this spine with header confirmation folded into mapping.

### Gaps
- TableFlow's README shows little UI; neither repo page showed a release date; the CSVBox export was read only to 200k of 514k characters.

## 2. How is the header row confirmed or changed when title rows sit above it?

### Takeaway
Pre-select a candidate row, let the user change it, drop the rows above.

### Cited Findings
- OneSchema requires a header for every file and skips the pane when detected headers match the template — [pane 2](https://docs.oneschema.co/docs/2-select-header-row)
- Dromo: integrator can preset the header index; rows above are discarded — [settings](https://developer.dromo.io/settings/)
- CSVBox: user picks the row; admin sets the pre-selected default; a no-header option exists; the step can be hidden — [docs export](https://help.csvbox.io/llms-full.txt)
- Flatfile default: scan the first 10 rows, take the one with most non-empty cells; alternatives are explicit row indices or sub-header detection — [xlsx extractor](https://flatfile.com/docs/plugins/xlsx-extractor)
- RSI makes it a separate step — [default strings](https://raw.githubusercontent.com/UgnisSoftware/react-spreadsheet-import/master/src/translationsRSIProps.ts); TableFlow can force row one — [README](https://github.com/tableflowhq/csv-import)

### Inferences
- Nothing read assumes row one silently unless the integrator opts in.

### Gaps
- OneSchema's heuristic (first mostly non-empty row) appeared only in a search snippet; the page returned 404. Dromo's and Flatfile's picker UIs are undocumented in the pages read.

## 3. What does the column-mapping screen show, and how are unmatched, required and duplicate assignments handled?

### Takeaway
One row per source column with a target dropdown pre-filled by exact, fuzzy, remembered or ML matching. Doubt is shown as a blank needing input.

### Cited Findings
- Flatfile: blank destination means input needed; hover shows a data preview and field description; ML matches are auto-applied (vendor claims over 90%); unmapped columns are dropped — [support](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview)
- Dromo: fuzzy suggestions optional; past mappings reused but editable; custom fields allowed; several columns may feed one field — [settings](https://developer.dromo.io/settings/), [changelog](https://developer.dromo.io/changelog.md)
- CSVBox: users mark columns ignored; bulk reset, ignore-all and AI auto-map; mapping direction configurable — [docs export](https://help.csvbox.io/llms-full.txt). OneSchema auto-maps exact matches and skips empty columns — [pane 3](https://docs.oneschema.co/docs/3-map-template-columns)
- RSI: source preview beside target; ignore toggle; reusing a field un-assigns the earlier column with a notice; unmatched required fields raise a confirmation listing them (inferred from UI strings) — [default strings](https://raw.githubusercontent.com/UgnisSoftware/react-spreadsheet-import/master/src/translationsRSIProps.ts)
- Guidance: show how each column matched; offer confirm, ignore or custom field — [Smashing Magazine](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/) (December 2020; examples may be dated)

### Inferences
- Reassign-and-notify handles duplicates with less friction than blocking.

### Gaps
- No numeric match-confidence indicator is documented in any page read; duplicate handling is documented only for RSI.

## 4. How does the review screen show errors, filters, editing and uncertainty?

### Takeaway
Editable grid, cell-level severity, messages on hover, issues-only filter, bulk fixes, and an explicit submit-with-errors policy.

### Cited Findings
- Flatfile: separate error and warning colours (warnings accepted); auto-transformed values underlined, original on hover; filters for valid, invalid and specific error; find and replace; double-click edit — [support](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview)
- Dromo: error, warning and info per cell; error panel with cards, column filter, keyboard stepping, clear or replace; policy is block, drop invalid rows after confirmation (default), or include after a warning — [changelog](https://developer.dromo.io/changelog.md), [settings](https://developer.dromo.io/settings/)
- CSVBox: inline cell errors; row badge; table banner; all-or-errors filter; clear invalid values, fill blanks, replace similar cells; export errors; undo — [docs export](https://help.csvbox.io/llms-full.txt)
- RSI: three severity levels, errors-only switch, discard selected rows — [README](https://github.com/UgnisSoftware/react-spreadsheet-import), [default strings](https://raw.githubusercontent.com/UgnisSoftware/react-spreadsheet-import/master/src/translationsRSIProps.ts)
- Guidance: errors-only toggle — [Smashing Magazine](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/); freeze header and identifier column, show filter state, inline edit only for narrow tables — [NN/g data tables](https://www.nngroup.com/articles/data-tables/) (April 2022)

### Inferences
- Uncertainty is shown categorically (warning tier, auto-changed marker), not as percentages. A confidence flag fits as a non-blocking tier sharing the same filter.

### Gaps
- No importer documents a low-confidence flag distinct from validation; OneSchema's review page omits error styling.

## 5. What do good importers show for empty, unreadable, oversized, wrong-type or table-less files?

### Takeaway
State limits before upload. Failures name the cause and the fix, and keep the user in the flow.

### Cited Findings
- Flatfile: a corrupted file gets a failure tag and pop-up with the fix (re-save, re-upload); for unsupported types the advice is to check the extension — [support](https://support.flatfile.com/articles/7763163677-importing-data-with-flatfile-overview)
- Dromo: oversize (default 1 GiB) shows an error; over the row cap warns and drops extra rows; submit disabled when no rows remain — [settings](https://developer.dromo.io/settings/)
- CSVBox: configurable accepted types; row cap with custom message, truncated count and optional continue; explicit message for password-protected files; server rejection returns to verify — [docs export](https://help.csvbox.io/llms-full.txt)
- RSI: rejected-upload notice, record-limit message stating the maximum, expected columns listed at upload — [default strings](https://raw.githubusercontent.com/UgnisSoftware/react-spreadsheet-import/master/src/translationsRSIProps.ts)
- Guidance: state format, required fields, row cap and template up front — [Smashing Magazine](https://www.smashingmagazine.com/2020/12/designing-attractive-usable-data-importer-app/); message at the source, cues beyond colour, severity-scaled prominence, plain specific wording with a remedy, preserve input — [NN/g error messages](https://www.nngroup.com/articles/error-message-guidelines/) (May 2023)

### Inferences
- Flatfile's help text implies wrong types can fail without a message; explicit wrong-type messaging is safer.

### Gaps
- No vendor documentation found for empty-file or no-table-found messages.

## 6. What published guidance covers importers and communicating AI confidence?

### Takeaway
Show confidence only where it changes a decision, prefer categories or alternatives to percentages, and route low confidence to review.

### Cited Findings
- Show confidence when it affects the decision; categorical levels scan easily but need defined cut-offs and an implied action; alternatives suit low confidence; percentages assume probability literacy and invite over-trust — [Google PAIR Guidebook](https://pair.withgoogle.com/chapter/explainability-trust/) (undated)
- Field confidence is an estimated probability (0.95 is right about 19 times in 20) for auto-accepting or flagging for human review; read table confidence top-down (table, row, cell); a confident cell can sit in a doubtful row — [Azure Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/accuracy-confidence) (April 2026)

### Inferences
- Use two or three named levels with a stated action, a row flag with a cell-level reason, and a flagged-rows filter.

### Gaps
- No usability study specific to confidence display in spreadsheet extraction was found.
