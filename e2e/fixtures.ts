import path from "node:path";

/** The sample files the app ships with; the tests upload them through the real file input. */
export const sample = (name: string) => path.join(__dirname, "..", "public", "samples", name);

/**
 * A layout none of the bundled samples has: two title lines, a blank line, header on row 4 with
 * names the samples do not use (Barcode, Product, Service Tag, Proc, Mem, Disk, LCD), a CPU as
 * Windows reports it, RAM in MB, and a subtotal row at the end.
 */
export const UNSEEN_CSV = [
  "Acme Recycling Pty Ltd - pickup manifest,,,,,,,",
  "Collected 02/10/2026,,,,,,,",
  ",,,,,,,",
  "Barcode,Make,Product,Service Tag,Proc,Mem,Disk,LCD",
  'A-100,Dell,Latitude 5490,7XK2PQ2,Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz,8GB,256GB SSD,"14"""',
  "A-101,Lenovo,ThinkPad T480,PF1ABCDE,i7-8550U,16 GB,512 GB NVMe,14",
  "A-102,HP,EliteDesk 800 G4,MXL9123ABC,Core i5-8500,8192 MB,1TB HDD,",
  "Subtotal,,,3,,,,",
].join("\r\n");
