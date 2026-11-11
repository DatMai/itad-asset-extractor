import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asset Sheet Extractor",
  description: "Turn a messy IT asset spreadsheet into a clean table, in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* System fonts: nothing to download, so the app also builds and runs offline. */}
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
