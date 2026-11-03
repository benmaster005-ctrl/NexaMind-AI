import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  ShadingType,
  Footer,
  Header,
  PageNumber,
  NumberFormat,
} from "docx";

const inputPath = path.resolve("docs/LIVRABLES_NEXAMIND_AI.md");
const outputPath = path.resolve("docs/LIVRABLES_NEXAMIND_AI.docx");

const mdContent = fs.readFileSync(inputPath, "utf-8");
const lines = mdContent.split(/\r?\n/);

const children = [];

function parseInlineRuns(text, baseStyle = {}) {
  const runs = [];
  // Regex to split by bold (**...**) and inline code (`...`) and italic (*...*)
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          bold: true,
          font: baseStyle.font || "Segoe UI",
          size: baseStyle.size || 22,
          color: baseStyle.color || "1E293B",
        })
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          size: baseStyle.size ? baseStyle.size - 2 : 20,
          color: "2563EB",
          shading: {
            type: ShadingType.CLEAR,
            fill: "F1F5F9",
          },
        })
      );
    } else if (token.startsWith("*") && token.endsWith("*") && !token.startsWith("**")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          italics: true,
          font: baseStyle.font || "Segoe UI",
          size: baseStyle.size || 22,
          color: baseStyle.color || "475569",
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: token,
          font: baseStyle.font || "Segoe UI",
          size: baseStyle.size || 22,
          color: baseStyle.color || "1E293B",
          bold: baseStyle.bold || false,
          italics: baseStyle.italics || false,
        })
      );
    }
  }
  return runs.length ? runs : [new TextRun({ text: " ", font: "Segoe UI", size: 22 })];
}

let inCodeBlock = false;
let codeLines = [];
let inTable = false;
let tableRowsData = [];

function flushCodeBlock() {
  if (codeLines.length === 0) return;
  const fullText = codeLines.join("\n");
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 120, line: 260 },
      shading: {
        type: ShadingType.CLEAR,
        fill: "F8FAFC",
      },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: "2563EB" },
        top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      },
      children: [
        new TextRun({
          text: fullText,
          font: "Consolas",
          size: 18,
          color: "0F172A",
        }),
      ],
    })
  );
  codeLines = [];
}

function flushTable() {
  if (tableRowsData.length === 0) return;

  const validRows = tableRowsData.filter((row) => {
    // filter separator line like |---|---|
    return !row.every((cell) => /^[-:| ]+$/.test(cell.trim()));
  });

  if (validRows.length === 0) {
    tableRowsData = [];
    return;
  }

  const tableRows = validRows.map((rowCells, rowIndex) => {
    const isHeader = rowIndex === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: rowCells.map((cellText) => {
        return new TableCell({
          shading: {
            type: ShadingType.CLEAR,
            fill: isHeader ? "1E3A8A" : rowIndex % 2 === 1 ? "FFFFFF" : "F8FAFC",
          },
          margins: {
            top: 120,
            bottom: 120,
            left: 150,
            right: 150,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
          children: [
            new Paragraph({
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: parseInlineRuns(cellText.trim(), {
                font: "Segoe UI",
                size: isHeader ? 20 : 19,
                color: isHeader ? "FFFFFF" : "1E293B",
                bold: isHeader,
              }),
            }),
          ],
        });
      }),
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    })
  );

  children.push(new Paragraph({ spacing: { after: 180 } }));
  tableRowsData = [];
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Code blocks toggle
  if (line.trim().startsWith("```")) {
    if (inCodeBlock) {
      flushCodeBlock();
      inCodeBlock = false;
    } else {
      if (inTable) {
        flushTable();
        inTable = false;
      }
      inCodeBlock = true;
      codeLines = [];
    }
    continue;
  }

  if (inCodeBlock) {
    codeLines.push(line);
    continue;
  }

  // Tables
  if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
    if (!inTable) {
      inTable = true;
      tableRowsData = [];
    }
    const rawCells = line.split("|").slice(1, -1);
    tableRowsData.push(rawCells.map((c) => c.trim()));
    continue;
  } else if (inTable) {
    flushTable();
    inTable = false;
  }

  // Empty lines
  if (!line.trim()) {
    continue;
  }

  // Horizontal rules
  if (line.trim() === "---" || line.trim() === "***") {
    children.push(
      new Paragraph({
        spacing: { before: 180, after: 180 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "E2E8F0" },
        },
      })
    );
    continue;
  }

  // Headings
  if (line.startsWith("# ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        spacing: { before: 360, after: 200 },
        children: [
          new TextRun({
            text: line.slice(2).trim(),
            bold: true,
            font: "Segoe UI",
            size: 38,
            color: "0F172A",
          }),
        ],
      })
    );
    continue;
  }

  if (line.startsWith("## ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 140 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 24, color: "2563EB" },
        },
        indent: { left: 140 },
        children: [
          new TextRun({
            text: line.slice(3).trim(),
            bold: true,
            font: "Segoe UI",
            size: 28,
            color: "1E3A8A",
          }),
        ],
      })
    );
    continue;
  }

  if (line.startsWith("### ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        children: [
          new TextRun({
            text: line.slice(4).trim(),
            bold: true,
            font: "Segoe UI",
            size: 24,
            color: "2563EB",
          }),
        ],
      })
    );
    continue;
  }

  if (line.startsWith("#### ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: line.slice(5).trim(),
            bold: true,
            font: "Segoe UI",
            size: 21,
            color: "334155",
          }),
        ],
      })
    );
    continue;
  }

  // Bullet items
  if (/^[-*+]\s+/.test(line.trim())) {
    const bulletText = line.trim().replace(/^[-*+]\s+/, "");
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 50, after: 50 },
        children: parseInlineRuns(bulletText, {
          font: "Segoe UI",
          size: 21,
          color: "1E293B",
        }),
      })
    );
    continue;
  }

  // Numbered list items
  if (/^\d+\.\s+/.test(line.trim())) {
    const numText = line.trim().replace(/^\d+\.\s+/, "");
    const matchNum = line.trim().match(/^(\d+)\./);
    const prefix = matchNum ? `${matchNum[1]}. ` : "• ";
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: 360 },
        children: [
          new TextRun({
            text: prefix,
            bold: true,
            font: "Segoe UI",
            size: 21,
            color: "2563EB",
          }),
          ...parseInlineRuns(numText, {
            font: "Segoe UI",
            size: 21,
            color: "1E293B",
          }),
        ],
      })
    );
    continue;
  }

  // Regular paragraph
  children.push(
    new Paragraph({
      spacing: { before: 70, after: 110, line: 280 },
      children: parseInlineRuns(line, {
        font: "Segoe UI",
        size: 21,
        color: "1E293B",
      }),
    })
  );
}

if (inCodeBlock) flushCodeBlock();
if (inTable) flushTable();

const doc = new Document({
  title: "Dossier des Livrables — NexaMind AI",
  description: "Dossier exhaustif des 13 livrables techniques et opérationnels",
  creator: "Équipe Produit NexaMind AI",
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            bottom: 1440,
            left: 1440,
            right: 1440,
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "NexaMind AI — Dossier des Livrables Techniques & Opérationnels",
                  font: "Segoe UI",
                  size: 16,
                  color: "94A3B8",
                  italics: true,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.SPACE_BETWEEN,
              children: [
                new TextRun({
                  text: "Confidentiel — NexaWorks © 2026",
                  font: "Segoe UI",
                  size: 16,
                  color: "94A3B8",
                }),
                new TextRun({
                  text: "Page ",
                  font: "Segoe UI",
                  size: 16,
                  color: "94A3B8",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Segoe UI",
                  size: 16,
                  color: "2563EB",
                  bold: true,
                }),
                new TextRun({
                  text: " / ",
                  font: "Segoe UI",
                  size: 16,
                  color: "94A3B8",
                }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  font: "Segoe UI",
                  size: 16,
                  color: "94A3B8",
                }),
              ],
            }),
          ],
        }),
      },
      children: children,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document Word généré avec succès : ${outputPath} (${buffer.length} octets)`);
});
