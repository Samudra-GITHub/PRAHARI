// Statutory compliance report PDF for a single mine.
//
// Adapted from the ReportLab generator in Jeevan's infra prototype
// (prahari-backend/backend/app/reports.py): same idea — a printable report
// with mine particulars, inspection history, and alerts — rebuilt in
// TypeScript on PRAHARI's real Prisma data, and extended with violations,
// environmental readings, a summary block, and an attestation line.
//
// Uses pdf-lib's built-in standard fonts (no font files on disk), so it works
// unchanged in the Next.js standalone build and in Docker.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Input — plain data, independent of Prisma query shapes
// ---------------------------------------------------------------------------

export type CompliancePdfInput = {
  mine: {
    name: string;
    code: string;
    location: string;
    region: string | null;
    status: string;
    complianceScore: number;
    createdAt: Date;
  };
  // "Outstanding" = not yet resolved: violations in OPEN/NOTIFIED/ESCALATED,
  // alerts in OPEN/ACKNOWLEDGED. These are the same sets the dashboard uses
  // for its *critical* counts, applied to every severity so that each summary
  // box agrees with the tables printed beneath it.
  summary: {
    inspections: { total: number; overdue: number; completed: number };
    violations: { total: number; outstanding: number; critical: number };
    alerts: { total: number; outstanding: number; critical: number };
    penaltiesTotal: number;
  };
  inspections: {
    scheduledDate: Date;
    completedDate: Date | null;
    type: string;
    status: string;
    riskScore: number | null;
    inspector: { name: string };
  }[];
  violations: {
    code: string;
    severity: string;
    status: string;
    description: string;
    penaltyAmount: number;
    createdAt: Date;
  }[];
  alerts: { createdAt: Date; type: string; severity: string; status: string; title: string }[];
  readings: {
    createdAt: Date;
    parameter: string;
    value: number;
    unit: string;
    threshold: number | null;
    exceededAt: Date | null;
  }[];
  // Each table is capped at `rowLimit`; true means older rows were omitted.
  truncated: { inspections: boolean; violations: boolean; alerts: boolean; readings: boolean };
  rowLimit: number;
  requestedBy: { name: string; role: string };
  generatedAt: Date;
};

// ---------------------------------------------------------------------------
// Geometry & palette — print-friendly, aligned with the PRAHARI UI tokens
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const INK = rgb(0.11, 0.12, 0.13);
const MUTED = rgb(0.42, 0.44, 0.46);
const RULE = rgb(0.84, 0.85, 0.86);
const FILL = rgb(0.955, 0.958, 0.962);
const FOREST = rgb(0.18, 0.415, 0.27);
const GOLD = rgb(0.72, 0.58, 0.29);
const DANGER = rgb(0.7, 0.16, 0.14);
const WARNING = rgb(0.66, 0.42, 0.05);

const IST = 'Asia/Kolkata';

// Standard PDF fonts only cover WinAnsi. Map common typography to safe
// equivalents; anything else unencodable becomes '?' rather than crashing
// the export (e.g. a Devanagari name entered by a user).
const REPLACEMENTS: Record<string, string> = {
  '₹': 'Rs.',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '→': '->',
  // Intl date/time formatting can emit no-break / narrow no-break spaces.
  '\u00a0': ' ',
  '\u202f': ' ',
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
}

function formatDateTime(d: Date): string {
  const s = d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });
  return `${s} IST`;
}

function humanize(value: string): string {
  const s = value.replace(/_/g, ' ').toLowerCase().replace(/\bai\b/g, 'AI');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Matches the role labels the PRAHARI frontend shows (lib/format.ts).
const ROLE_LABELS: Record<string, string> = {
  FIELD_INSPECTOR: 'Field Inspector',
  MINE_OFFICIAL: 'Mine Official',
  CORPORATE_ADMIN: 'Corporate Admin',
  REGULATOR: 'Regulator',
};

function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function documentRef(code: string, at: Date): string {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(at)
    .replace(/-/g, '');
  return `PRH-${code}-${ymd}`;
}

// `exceededAt` is overloaded by the environmental workflow trigger
// (src/lib/workflow/triggers.ts): null = not yet evaluated, the Unix epoch =
// evaluated and within limit, any other timestamp = exceeded at that time.
function readingState(exceededAt: Date | null): { label: string; color?: RGB } {
  if (exceededAt === null) return { label: 'Pending review' };
  if (exceededAt.getTime() === 0) return { label: 'Within limit' };
  return { label: `Exceeded ${formatDate(exceededAt)}`, color: DANGER };
}

const SEVERE = new Set(['CRITICAL', 'OVERDUE', 'ESCALATED']);
const ELEVATED = new Set(['HIGH', 'MAJOR']);

function toneFor(value: string): RGB | undefined {
  if (SEVERE.has(value)) return DANGER;
  if (ELEVATED.has(value)) return WARNING;
  return undefined;
}

// ---------------------------------------------------------------------------
// Layout engine — a cursor that paginates text, key/value blocks, and tables
// ---------------------------------------------------------------------------

type Cell = string | { text: string; color?: RGB; bold?: boolean };
type Column = { header: string; width: number; align?: 'left' | 'right' };

class ReportLayout {
  private page!: PDFPage;
  private y = 0;
  private readonly encodable = new Map<string, boolean>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly runningTitle: string,
  ) {}

  start(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    this.text(this.runningTitle, MARGIN_X, this.y, 8, this.font, MUTED);
    this.y -= 8;
    this.rule(this.y, RULE, 0.6);
    this.y -= 18;
  }

  private ensure(height: number): boolean {
    if (this.y - height >= MARGIN_BOTTOM) return false;
    this.newPage();
    return true;
  }

  sanitize(text: string): string {
    let out = '';
    for (const raw of text.replace(/[\r\n\t]+/g, ' ')) {
      const ch = REPLACEMENTS[raw] ?? raw;
      let ok = this.encodable.get(ch);
      if (ok === undefined) {
        try {
          this.font.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(ch, ok);
      }
      out += ok ? ch : '?';
    }
    return out;
  }

  private text(value: string, x: number, y: number, size: number, font: PDFFont, color: RGB): void {
    this.page.drawText(this.sanitize(value), { x, y, size, font, color });
  }

  private rule(y: number, color: RGB, thickness: number): void {
    this.page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: PAGE_WIDTH - MARGIN_X, y },
      thickness,
      color,
    });
  }

  private wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = this.sanitize(value).split(' ').filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      // A single token wider than the column (IDs, URLs) — hard-break it.
      let chunk = '';
      for (const ch of word) {
        if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
    return lines;
  }

  // --- Blocks --------------------------------------------------------------

  header(input: CompliancePdfInput): void {
    const top = this.y;
    this.text('PRAHARI', MARGIN_X, top - 4, 17, this.bold, FOREST);
    this.text('Mining Compliance Management System', MARGIN_X, top - 19, 8.5, this.font, MUTED);

    const right = (value: string, y: number, size: number, font: PDFFont, color: RGB) => {
      const clean = this.sanitize(value);
      this.page.drawText(clean, {
        x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(clean, size),
        y,
        size,
        font,
        color,
      });
    };
    right('STATUTORY COMPLIANCE REPORT', top - 2, 9, this.bold, INK);
    right(`Generated ${formatDateTime(input.generatedAt)}`, top - 14, 7.5, this.font, MUTED);
    right(`Ref ${documentRef(input.mine.code, input.generatedAt)}`, top - 24, 7.5, this.font, MUTED);

    this.y = top - 36;
    this.rule(this.y, GOLD, 1.4);
    this.y -= 30;

    this.text(input.mine.name, MARGIN_X, this.y, 18, this.bold, INK);
    this.y -= 15;
    const sub = [input.mine.code, input.mine.location, input.mine.region].filter(Boolean).join('  ·  ');
    this.text(sub, MARGIN_X, this.y, 9, this.font, MUTED);
    this.y -= 26;
  }

  section(title: string, note?: string): void {
    this.ensure(46);
    this.text(title.toUpperCase(), MARGIN_X, this.y, 8.5, this.bold, FOREST);
    if (note) {
      const clean = this.sanitize(note);
      this.page.drawText(clean, {
        x: PAGE_WIDTH - MARGIN_X - this.font.widthOfTextAtSize(clean, 7.5),
        y: this.y,
        size: 7.5,
        font: this.font,
        color: MUTED,
      });
    }
    this.y -= 7;
    this.rule(this.y, RULE, 0.6);
    this.y -= 12;
  }

  keyValues(rows: [string, Cell][]): void {
    const labelWidth = CONTENT_WIDTH * 0.3;
    const size = 9;
    const lineHeight = 12;
    for (const [label, cell] of rows) {
      const value = typeof cell === 'string' ? { text: cell } : cell;
      const lines = this.wrap(value.text, value.bold ? this.bold : this.font, size, CONTENT_WIDTH - labelWidth - 12);
      const height = lines.length * lineHeight + 8;
      this.ensure(height);
      this.page.drawRectangle({ x: MARGIN_X, y: this.y - height, width: labelWidth, height, color: FILL });
      this.text(label, MARGIN_X + 8, this.y - 12, 8.5, this.font, MUTED);
      lines.forEach((line, i) => {
        this.page.drawText(line, {
          x: MARGIN_X + labelWidth + 10,
          y: this.y - 12 - i * lineHeight,
          size,
          font: value.bold ? this.bold : this.font,
          color: value.color ?? INK,
        });
      });
      this.y -= height;
      this.page.drawLine({
        start: { x: MARGIN_X, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
        thickness: 0.5,
        color: RULE,
      });
    }
    this.y -= 22;
  }

  stats(items: { label: string; value: string; color?: RGB }[], columns = 3, trailingSpace = 14): void {
    const gap = 8;
    const boxWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const boxHeight = 46;
    for (let i = 0; i < items.length; i += columns) {
      this.ensure(boxHeight + gap);
      items.slice(i, i + columns).forEach((item, j) => {
        const x = MARGIN_X + j * (boxWidth + gap);
        this.page.drawRectangle({
          x,
          y: this.y - boxHeight,
          width: boxWidth,
          height: boxHeight,
          borderColor: RULE,
          borderWidth: 0.6,
        });
        this.text(item.label.toUpperCase(), x + 10, this.y - 15, 6.5, this.bold, MUTED);
        this.text(item.value, x + 10, this.y - 35, 15, this.bold, item.color ?? INK);
      });
      this.y -= boxHeight + gap;
    }
    this.y -= trailingSpace;
  }

  table(columns: Column[], rows: Cell[][], emptyText: string): void {
    const size = 8;
    const lineHeight = 10.5;
    const padX = 5;
    const padY = 5;
    const maxLines = 40; // any single row still fits on one page
    const widths = columns.map((c) => c.width * CONTENT_WIDTH);
    // A left-aligned column straight after a right-aligned one (e.g. a date
    // after an amount) gets an extra gutter so the two don't run together.
    const insets = columns.map((c, i) => (c.align !== 'right' && columns[i - 1]?.align === 'right' ? padX + 10 : padX));

    const drawHeader = () => {
      const height = 18;
      this.page.drawRectangle({ x: MARGIN_X, y: this.y - height, width: CONTENT_WIDTH, height, color: FILL });
      let x = MARGIN_X;
      columns.forEach((col, i) => {
        const label = col.header.toUpperCase();
        const w = this.bold.widthOfTextAtSize(label, 6.5);
        const tx = col.align === 'right' ? x + widths[i] - padX - w : x + insets[i];
        this.page.drawText(label, { x: tx, y: this.y - 12, size: 6.5, font: this.bold, color: MUTED });
        x += widths[i];
      });
      this.y -= height;
    };

    if (rows.length === 0) {
      this.ensure(30);
      this.text(emptyText, MARGIN_X, this.y - 10, 9, this.font, MUTED);
      this.y -= 34;
      return;
    }

    this.ensure(18 + lineHeight + padY * 2);
    drawHeader();

    for (const row of rows) {
      const cells = row.map((cell) => (typeof cell === 'string' ? { text: cell } : cell));
      const wrapped = cells.map((cell, i) =>
        this.wrap(cell.text, cell.bold ? this.bold : this.font, size, widths[i] - padX - insets[i]).slice(0, maxLines),
      );
      const height = Math.max(...wrapped.map((l) => l.length)) * lineHeight + padY * 2;

      if (this.ensure(height)) drawHeader();

      let x = MARGIN_X;
      cells.forEach((cell, i) => {
        const font = cell.bold ? this.bold : this.font;
        wrapped[i].forEach((line, li) => {
          const w = font.widthOfTextAtSize(line, size);
          const tx = columns[i].align === 'right' ? x + widths[i] - padX - w : x + insets[i];
          this.page.drawText(line, {
            x: tx,
            y: this.y - padY - 7.5 - li * lineHeight,
            size,
            font,
            color: cell.color ?? INK,
          });
        });
        x += widths[i];
      });

      this.y -= height;
      this.page.drawLine({
        start: { x: MARGIN_X, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
        thickness: 0.5,
        color: RULE,
      });
    }
    this.y -= 24;
  }

  paragraph(value: string, size = 8.5, color: RGB = MUTED): void {
    const lineHeight = size * 1.45;
    const lines = this.wrap(value, this.font, size, CONTENT_WIDTH);
    this.ensure(lines.length * lineHeight + 4);
    lines.forEach((line) => {
      this.page.drawText(line, { x: MARGIN_X, y: this.y - size, size, font: this.font, color });
      this.y -= lineHeight;
    });
    this.y -= 8;
  }

  footers(): void {
    const pages = this.doc.getPages();
    const left = this.sanitize('PRAHARI  ·  Confidential — for authorised regulatory use');
    pages.forEach((page, i) => {
      const y = MARGIN_BOTTOM - 28;
      page.drawLine({
        start: { x: MARGIN_X, y: y + 12 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: y + 12 },
        thickness: 0.5,
        color: RULE,
      });
      page.drawText(left, { x: MARGIN_X, y, size: 7, font: this.font, color: MUTED });
      const label = `Page ${i + 1} of ${pages.length}`;
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN_X - this.font.widthOfTextAtSize(label, 7),
        y,
        size: 7,
        font: this.font,
        color: MUTED,
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildCompliancePdf(input: CompliancePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Statutory Compliance Report — ${input.mine.name}`);
  doc.setSubject(`Compliance report for mine ${input.mine.code}`);
  doc.setAuthor('PRAHARI');
  doc.setCreator('PRAHARI Mining Compliance Management System');
  doc.setProducer('PRAHARI');
  doc.setLanguage('en-IN');
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const layout = new ReportLayout(doc, font, bold, `PRAHARI  ·  Statutory Compliance Report  ·  ${input.mine.name}`);
  const truncatedNote = (flag: boolean) => (flag ? `Most recent ${input.rowLimit} records shown` : undefined);

  layout.start();
  layout.header(input);

  const { summary, mine } = input;

  layout.section('Mine particulars');
  layout.keyValues([
    ['Mine code', mine.code],
    ['Name', mine.name],
    ['Location', mine.location],
    ['Region', mine.region ?? '—'],
    ['Operational status', { text: humanize(mine.status), color: mine.status === 'ACTIVE' ? INK : WARNING }],
    ['Compliance score', { text: `${mine.complianceScore.toFixed(1)} / 100`, bold: true }],
    ['On record since', formatDate(mine.createdAt)],
  ]);

  layout.section('Compliance summary');
  // Rows read the same way: total, then unresolved, then the severe subset.
  // Zero trailing space so the penalties bar below sits in the same grid.
  layout.stats([
    { label: 'Inspections on record', value: String(summary.inspections.total) },
    { label: 'Completed inspections', value: String(summary.inspections.completed) },
    {
      label: 'Overdue inspections',
      value: String(summary.inspections.overdue),
      color: summary.inspections.overdue > 0 ? WARNING : undefined,
    },
    { label: 'Violations on record', value: String(summary.violations.total) },
    { label: 'Violations outstanding', value: String(summary.violations.outstanding) },
    {
      label: 'Critical violations outstanding',
      value: String(summary.violations.critical),
      color: summary.violations.critical > 0 ? DANGER : undefined,
    },
    { label: 'Alerts on record', value: String(summary.alerts.total) },
    { label: 'Alerts outstanding', value: String(summary.alerts.outstanding) },
    {
      label: 'Critical alerts outstanding',
      value: String(summary.alerts.critical),
      color: summary.alerts.critical > 0 ? DANGER : undefined,
    },
  ], 3, 0);
  layout.stats([{ label: 'Total penalties levied (INR)', value: formatInr(summary.penaltiesTotal) }], 1);

  layout.section('Inspection history', truncatedNote(input.truncated.inspections));
  layout.table(
    [
      { header: 'Scheduled', width: 0.15 },
      { header: 'Type', width: 0.15 },
      { header: 'Status', width: 0.15 },
      { header: 'Inspector', width: 0.23 },
      { header: 'Completed', width: 0.16 },
      { header: 'AI risk', width: 0.16, align: 'right' },
    ],
    input.inspections.map((i) => [
      formatDate(i.scheduledDate),
      humanize(i.type),
      { text: humanize(i.status), color: toneFor(i.status) },
      i.inspector.name,
      formatDate(i.completedDate),
      i.riskScore === null
        ? '—'
        : { text: i.riskScore.toFixed(2), color: i.riskScore >= 0.8 ? DANGER : undefined, bold: i.riskScore >= 0.8 },
    ]),
    'No inspections on record.',
  );

  layout.section('Violations', truncatedNote(input.truncated.violations));
  layout.table(
    [
      { header: 'Code', width: 0.11 },
      { header: 'Severity', width: 0.12 },
      { header: 'Status', width: 0.12 },
      { header: 'Description', width: 0.37 },
      { header: 'Penalty (INR)', width: 0.14, align: 'right' },
      { header: 'Issued', width: 0.14 },
    ],
    input.violations.map((v) => [
      { text: v.code, bold: true },
      { text: humanize(v.severity), color: toneFor(v.severity) },
      { text: humanize(v.status), color: toneFor(v.status) },
      v.description,
      formatInr(v.penaltyAmount),
      formatDate(v.createdAt),
    ]),
    'No violations on record.',
  );

  layout.section('Alerts', truncatedNote(input.truncated.alerts));
  layout.table(
    [
      { header: 'Raised', width: 0.14 },
      { header: 'Type', width: 0.2 },
      { header: 'Severity', width: 0.12 },
      { header: 'Status', width: 0.14 },
      { header: 'Title', width: 0.4 },
    ],
    input.alerts.map((a) => [
      formatDate(a.createdAt),
      humanize(a.type),
      { text: humanize(a.severity), color: toneFor(a.severity) },
      humanize(a.status),
      a.title,
    ]),
    'No alerts on record.',
  );

  layout.section('Environmental readings', truncatedNote(input.truncated.readings));
  layout.table(
    [
      { header: 'Recorded', width: 0.16 },
      { header: 'Parameter', width: 0.2 },
      { header: 'Value', width: 0.18, align: 'right' },
      { header: 'Threshold', width: 0.18, align: 'right' },
      { header: 'Evaluation', width: 0.28 },
    ],
    input.readings.map((r) => {
      const state = readingState(r.exceededAt);
      return [
        formatDate(r.createdAt),
        r.parameter,
        `${r.value} ${r.unit}`,
        r.threshold === null ? 'Default' : `${r.threshold} ${r.unit}`,
        { text: state.label, color: state.color },
      ];
    }),
    'No environmental readings on record.',
  );

  layout.section('Attestation');
  layout.paragraph(
    `This report was generated by PRAHARI from the records held for ${mine.name} (${mine.code}) ` +
      `as of ${formatDateTime(input.generatedAt)}. It was requested by ${input.requestedBy.name} ` +
      `(${ROLE_LABELS[input.requestedBy.role] ?? humanize(input.requestedBy.role)}), and the export has been recorded in PRAHARI's tamper-evident audit log. ` +
      `Compliance scores, risk scores, and alert classifications reflect the system of record at the time of ` +
      `generation and should be read together with the underlying inspection documentation.`,
  );

  layout.footers();
  return doc.save();
}
