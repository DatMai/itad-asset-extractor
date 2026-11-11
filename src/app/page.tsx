import { Importer } from "@/components/Importer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Asset Sheet Extractor</h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Upload an IT asset spreadsheet in any layout. The app finds the header row, works out what each column
          holds, splits cells that mix several facts, and shows what it is unsure about.
        </p>
      </header>
      <Importer />
    </main>
  );
}
