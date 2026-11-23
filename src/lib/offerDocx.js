// Word (.docx) version of the offer letter, built from the same blocks as the on-screen letter.
// Loaded on demand so the docx library is only fetched when someone downloads a Word file.
export async function offerDocxBlob(pages, company) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, ImageRun, BorderStyle } = await import("docx");
  const FONT = "Calibri";
  const run = (r, extra = {}) => new TextRun({ text: r.t, bold: r.b, italics: r.i, font: FONT, size: 21, ...extra });
  const para = (children, opts = {}) => new Paragraph({ children, spacing: { after: 120, line: 276 }, ...opts });
  let logo = null;
  if (company.logo?.startsWith("data:image/png")) {
    const bin = atob(company.logo.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    logo = bytes;
  }
  const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: logo ? [new ImageRun({ type: "png", data: logo, transformation: { width: 150, height: 42 } })] : [new TextRun({ text: company.brand, bold: true, font: FONT, size: 32 })] })] });
  const footer = new Footer({
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${company.legal_name} · CIN: ${company.cin}`, font: FONT, size: 15, bold: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${company.office.join(", ")} · T: ${company.phone} · ${company.website}`, font: FONT, size: 15 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: company.confidential, font: FONT, size: 15, italics: true })] }),
    ],
  });
  const border = { style: BorderStyle.SINGLE, size: 4, color: "B8C4C8" };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const blockToDocx = (b) => {
    switch (b.kind) {
      case "p": return [para(b.runs.map((r) => run(r)), { alignment: AlignmentType.JUSTIFIED })];
      case "h": return [para([run({ t: b.text, b: true }, { size: 23, color: "0F4C5C" })], { spacing: { before: 200, after: 80 } })];
      case "addr": return b.lines.map((l) => new Paragraph({ children: [run({ t: l })], spacing: { after: 0 } }));
      case "right": return [para([run({ t: b.text })], { alignment: AlignmentType.RIGHT })];
      case "center": return [para([run({ t: b.text, b: true }, { size: 24 })], { alignment: AlignmentType.CENTER })];
      case "gap": return [new Paragraph({ children: [] })];
      case "sign": return [new Paragraph({ children: [], spacing: { after: 360 } }), para([run({ t: b.name, b: true })], { spacing: { after: 0 } }), para([run({ t: b.title, b: true })])];
      case "lines": return b.items.map((l) => para([run({ t: `${l}: ______________________________` })]));
      case "kv": return b.items.map(([k, v]) => para([run({ t: `${k}: `, b: true }), run({ t: v })]));
      case "ol": return b.items.map((t, i) => para([run({ t: `(${i + 1}) ${t}` })], { indent: { left: 360, hanging: 360 }, alignment: AlignmentType.JUSTIFIED }));
      case "table":
        return [new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: b.head.map((h, i) => new TableCell({ borders: cellBorders, shading: { fill: "E6EEF0" }, children: [new Paragraph({ alignment: i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run({ t: h, b: true }, { size: 19 })] })] })) }),
            ...b.rows.map((r) => new TableRow({ children: r.cells.map((c, i) => new TableCell({ borders: cellBorders, shading: r.section ? { fill: "F3F6F7" } : undefined, children: [new Paragraph({ alignment: i >= 2 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run({ t: String(c), b: r.b }, { size: 19 })] })] })) })),
          ],
        })];
      default: return [];
    }
  };
  const doc = new Document({
    creator: company.legal_name,
    title: "Offer letter",
    sections: pages.map((blocks) => ({ properties: { page: { margin: { top: 1300, bottom: 1300, left: 1100, right: 1100 } } }, headers: { default: header }, footers: { default: footer }, children: blocks.flatMap(blockToDocx) })),
  });
  return Packer.toBlob(doc);
}
