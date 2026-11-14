/**
 * Excel/PDF export helpers.
 *
 * `xlsx`, `jspdf` and `jspdf-autotable` are large (~1.5 MB combined). They are
 * loaded on demand the first time a user actually exports something, instead of
 * being part of the initial bundle for every visitor.
 */

let excelModule: Promise<typeof import('xlsx')> | null = null;
let pdfModules: Promise<{ jsPDF: any; autoTable: any }> | null = null;

function loadExcel() {
  excelModule ??= import('xlsx');
  return excelModule;
}

function loadPdf() {
  pdfModules ??= Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([jspdf, autotable]) => ({
    jsPDF: (jspdf as any).default ?? jspdf,
    autoTable: (autotable as any).default ?? autotable,
  }));
  return pdfModules;
}

function reportExportError(err: unknown) {
  console.error('[Naafay] Export failed:', err);
  if (typeof window !== 'undefined') {
    window.alert(
      document.documentElement.lang === 'en'
        ? 'Export failed. Please try again.'
        : 'ایکسپورٹ ناکام ہو گیا۔ براہِ کرم دوبارہ کوشش کریں۔'
    );
  }
}

export function exportToExcel(filename: string, sheetName: string, rows: Record<string, any>[]) {
  void loadExcel()
    .then((XLSX) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      XLSX.writeFile(wb, `${filename}.xlsx`);
    })
    .catch(reportExportError);
}

export function exportToPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  void loadPdf()
    .then(({ jsPDF, autoTable }) => {
      const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
      doc.setFontSize(14);
      doc.setTextColor(6, 95, 70);
      doc.text('Naafay Dar-ul-Ifta & Takhassus fil Fiqh', 14, 15);
      doc.setFontSize(11);
      doc.setTextColor(17, 28, 24);
      doc.text(title, 14, 23);
      doc.setFontSize(9);
      doc.setTextColor(95, 112, 105);
      doc.text(subtitle, 14, 29);

      autoTable(doc, {
        startY: 35,
        head: [headers],
        body: rows,
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [6, 95, 70], textColor: 255 },
        alternateRowStyles: { fillColor: [246, 248, 247] },
      });

      doc.save(`${filename}.pdf`);
    })
    .catch(reportExportError);
}
