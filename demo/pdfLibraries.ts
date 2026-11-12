// The PDF libraries for the demo. They are imported here, in their own file, and this file is only loaded
// when someone exports a PDF, so the rest of the demo works even before `npm install` added them.
// In your own app, write the same thing: a function that imports the libraries on demand.
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PdfLibraries } from "../src";

export const pdfLibraries: PdfLibraries = { jsPDF, autoTable, html2canvas };
