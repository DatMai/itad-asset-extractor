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

/**
 * Three customers' manifests stacked in one sheet. Each has a title row, its own column names
 * and its own column order; the second has two more columns than the first.
 */
export const STACKED_CSV = [
  "Customer 1 — Northwind,,,,,,,,,",
  "S/N,Make,Device Cat.,Model #,CPU Spec,Disp. (in),Mem.,HDD/SSD,,",
  "SN-NW-001,Dell,Laptop,Latitude 5520,Intel Core i5-1135G7,15.6 in,16 GB,512 GB,,",
  "SN-NW-002,Lenovo,Notebook,ThinkPad X1 Carbon Gen 10,Intel Core i7-1265U,14,32 gig,1 TB,,",
  ",,,,,,,,,",
  ",,,,,,,,,",
  "Customer 2 — Contoso Leasing,,,,,,,,,",
  "Asset Identifier,Serial No.,Brand,Full Model Name,Form Factor,Processor Description,Screen Diagonal,Installed RAM,Primary Storage Capacity,Purchase Date",
  "CL-2024-0001,AB12CD34,HP,ZBook Fury 16 G9,Mobile Workstation,Intel Core i9-12950HX,16 in,16384MB,4TB,2024-04-02",
  "CL-2024-0002,EF56GH78,Dell,OptiPlex 7010,Tower Desktop,Intel Core i7-13700,,16 GB,512 GB,2024-05-01",
  ",,,,,,,,,",
  "Customer 3 — Fabrikam,,,,,,,,,",
  "tag,sn,mfr,type,mdl,proc,screen,ram,drive,cond",
  "FB-7741,X9W2HKLM,Dell,laptop,XPS 15 9520,i7-12700H,15.6,16,512gb,A",
  "FB-7742,PB3FRTQV,Apple,macbook,MacBook Pro 13 M2,M2,13.3,8,256GB,A",
].join("\r\n");
