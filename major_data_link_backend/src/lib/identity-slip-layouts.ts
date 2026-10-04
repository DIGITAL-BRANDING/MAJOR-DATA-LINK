import {
  SLIP_DISCLAIMER,
  buildPdf,
  drawPhoto,
  drawPhotoPlaceholder,
  drawQr,
  formatIssued,
  formatNin,
  qrPayload,
  splitFields,
  takeRest,
  valueForPdf,
  type IdentitySlipField,
  type IdentitySlipParams,
  type PdfDoc
} from './identity-slip-common.js';

/**
 * The three NIN layouts beyond the original premium look (which stays in
 * render-identity-slip-pdf.ts). All are K-TECH SOLUTIONS documents: own
 * header, own colours, our own reference QR, and an explicit "not issued by
 * NIMC" line. They intentionally do not reproduce any government emblem,
 * agency logo or official-document wording.
 */

const NAVY = '#102a5c';
const TEAL = '#0f766e';
const TEAL_DARK = '#134e4a';
const INDIGO = '#312e81';
const GREY = '#64748b';
const INK = '#111827';
const LEFT = 40;
const RIGHT = 555;
const WIDTH = RIGHT - LEFT;
const PAGE_BOTTOM = 770;

function headerBand(doc: PdfDoc, color: string, tag: string) {
  doc.rect(LEFT, 40, WIDTH, 56).fill(color);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('K-TECH SOLUTIONS', LEFT + 18, 57, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#dbe4f5').text('Identity verification', LEFT + 18, 77, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(tag, 300, 63, { width: RIGHT - 18 - 300, align: 'right', lineBreak: false });
}

function title(doc: PdfDoc, heading: string, subtitle: string) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(heading, LEFT, 112, { width: WIDTH, align: 'center', lineBreak: false });
  doc.fillColor(GREY).font('Helvetica').fontSize(9).text(subtitle, LEFT, 132, { width: WIDTH, align: 'center', lineBreak: false });
}

function caption(doc: PdfDoc, text: string, x: number, y: number, width: number, color = GREY) {
  doc.fillColor(color).font('Helvetica-Bold').fontSize(7).text(text.toUpperCase(), x, y, { width, lineBreak: false });
}

function value(doc: PdfDoc, text: string | undefined, x: number, y: number, size: number, width: number, color = INK) {
  doc.fillColor(color).font('Helvetica-Bold').fontSize(size).text(valueForPdf(text), x, y, { width, height: size * 2.6, ellipsis: true });
}

function disclaimer(doc: PdfDoc, y: number) {
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text(SLIP_DISCLAIMER, LEFT, y, { width: WIDTH, align: 'center' });
}

/** Label/value rows (label column on the left) used for the "additional details" lists. */
function detailRows(doc: PdfDoc, rows: IdentitySlipField[], startY: number, accent: string, labelFill: string): number {
  const labelW = 160;
  const rowH = 24;
  let y = startY;
  for (const row of rows) {
    if (y + rowH > PAGE_BOTTOM) {
      doc.addPage();
      y = 60;
    }
    doc.rect(LEFT, y, labelW, rowH).fill(labelFill);
    doc.rect(LEFT + labelW, y, WIDTH - labelW, rowH).fill('#ffffff');
    doc.lineWidth(0.5).strokeColor(accent).rect(LEFT, y, WIDTH, rowH).stroke();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text(row.label, LEFT + 8, y + 8, { width: labelW - 16, lineBreak: false });
    doc.font('Helvetica').fontSize(9).text(valueForPdf(row.value), LEFT + labelW + 8, y + 7.5, { width: WIDTH - labelW - 16, height: rowH - 8, ellipsis: true });
    y += rowH;
  }
  return y;
}

// ── Standard: "digital slip" ID-card panel ───────────────────────────────

export function drawStandardDigital(doc: PdfDoc, p: IdentitySlipParams) {
  const f = splitFields(p.fields);
  headerBand(doc, NAVY, 'STANDARD DIGITAL SLIP');
  title(doc, `${p.title} \u2014 Verified`, p.subtitle);

  const cardY = 156;
  doc.roundedRect(LEFT, cardY, WIDTH, 290, 10).fill('#f1f8f7');
  doc.lineWidth(1.2).strokeColor(TEAL).roundedRect(LEFT, cardY, WIDTH, 290, 10).stroke();

  const photoX = LEFT + 18;
  const photoY = cardY + 18;
  if (!drawPhoto(doc, p.photo, photoX, photoY, 128, 160)) drawPhotoPlaceholder(doc, photoX, photoY, 128, 160);
  doc.lineWidth(1).strokeColor(TEAL).rect(photoX, photoY, 128, 160).stroke();

  const textX = 206;
  caption(doc, 'Surname', textX, cardY + 20, 230);
  value(doc, f.surname, textX, cardY + 32, 15, 230);
  caption(doc, 'Given names', textX, cardY + 62, 230);
  value(doc, f.givenNames, textX, cardY + 74, 15, 230);
  caption(doc, 'Date of birth', textX, cardY + 106, 140);
  value(doc, f.dob, textX, cardY + 118, 13, 140);
  caption(doc, 'Gender', 372, cardY + 106, 100);
  value(doc, f.gender, 372, cardY + 118, 13, 100);

  const ninY = cardY + 196;
  doc.rect(photoX, ninY, 300, 62).fill('#dcefed');
  doc.lineWidth(1).strokeColor(TEAL).rect(photoX, ninY, 300, 62).stroke();
  caption(doc, 'National Identification Number (NIN)', photoX + 10, ninY + 9, 280, TEAL_DARK);
  doc.fillColor(TEAL_DARK).font('Helvetica-Bold').fontSize(22).text(valueForPdf(formatNin(f.nin)), photoX + 10, ninY + 25, { width: 280, lineBreak: false });

  drawQr(doc, qrPayload(p.reference), 443, cardY + 172, 98);
  doc.fillColor(GREY).font('Helvetica').fontSize(6.5).text('Scan for K-TECH reference', 443, cardY + 272, { width: 98, align: 'center', lineBreak: false });

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text('Additional details', LEFT, 468, { lineBreak: false });
  const rows: IdentitySlipField[] = [
    { label: 'Reference', value: p.reference },
    { label: 'Issued', value: formatIssued(p.issuedAt) },
    ...f.rest,
    { label: 'Status', value: 'Verified' }
  ];
  const endY = detailRows(doc, rows, 486, TEAL, '#e6f2f1');
  disclaimer(doc, Math.min(Math.max(endY + 22, 780), 800));
}

// ── Regular: plain bordered form grid ────────────────────────────────────

export function drawRegularForm(doc: PdfDoc, p: IdentitySlipParams) {
  const f = splitFields(p.fields);
  const rest = [...f.rest];
  const phone = takeRest(rest, /phone|mobile/i);
  const address =
    takeRest(rest, /address/i) ??
    ([takeRest(rest, /town|lga/i), takeRest(rest, /state/i)].filter(Boolean).join(', ') || undefined);

  doc.rect(LEFT, 40, WIDTH, 3).fill(INK);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text('K-TECH SOLUTIONS', LEFT, 56, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(11).text('IDENTITY VERIFICATION SLIP', 300, 52, { width: RIGHT - 300, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(GREY).text('Regular', 300, 68, { width: RIGHT - 300, align: 'right', lineBreak: false });
  doc.lineWidth(0.8).strokeColor(INK).moveTo(LEFT, 92).lineTo(RIGHT, 92).stroke();
  doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(9).text(`${p.title} \u2014 ${p.subtitle}`, LEFT, 100, { lineBreak: false });

  const gridY = 124;
  const rowH = 40;
  const leftW = 395;
  const cellW = leftW / 2;
  const photoX = LEFT + leftW + 12;
  const photoW = RIGHT - photoX;

  const cell = (label: string, text: string | undefined, x: number, y: number, w: number, h = rowH) => {
    doc.lineWidth(0.8).strokeColor(INK).rect(x, y, w, h).stroke();
    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 6, y + 6, { width: w - 12, lineBreak: false });
    doc.fillColor(INK).font('Helvetica').fontSize(10.5).text(valueForPdf(text), x + 6, y + 19, { width: w - 12, height: h - 20, ellipsis: true });
  };

  const pairs: [[string, string | undefined], [string, string | undefined]][] = [
    [['NIN', formatNin(f.nin)], ['Surname', f.surname]],
    [['First name', f.firstName], ['Middle name', f.middleName]],
    [['Gender', f.gender], ['Date of birth', f.dob]],
    [['Phone', phone], ['Reference', p.reference]]
  ];
  pairs.forEach(([a, b], i) => {
    cell(a[0], a[1], LEFT, gridY + i * rowH, cellW);
    cell(b[0], b[1], LEFT + cellW, gridY + i * rowH, cellW);
  });
  cell('Address / residence', address, LEFT, gridY + 4 * rowH, leftW);
  cell('Issued', formatIssued(p.issuedAt), LEFT, gridY + 5 * rowH, cellW);
  cell('Status', 'VERIFIED', LEFT + cellW, gridY + 5 * rowH, cellW);

  const photoH = 6 * rowH;
  doc.lineWidth(0.8).strokeColor(INK).rect(photoX, gridY, photoW, photoH).stroke();
  if (!drawPhoto(doc, p.photo, photoX + 3, gridY + 3, photoW - 6, photoH - 6)) {
    drawPhotoPlaceholder(doc, photoX + 3, gridY + 3, photoW - 6, photoH - 6);
  }

  let y = gridY + photoH + 14;
  const extras = rest.filter((field) => field.value && field.value.trim() !== '' && field.value !== '****');
  for (let i = 0; i < extras.length; i += 2) {
    if (y + 36 > PAGE_BOTTOM) {
      doc.addPage();
      y = 60;
    }
    const half = WIDTH / 2;
    cell(extras[i].label, extras[i].value ?? undefined, LEFT, y, half, 36);
    if (extras[i + 1]) cell(extras[i + 1].label, extras[i + 1].value ?? undefined, LEFT + half, y, half, 36);
    y += 36;
  }
  disclaimer(doc, Math.min(Math.max(y + 24, 780), 800));
}

// ── vNIN: minimal-disclosure verification record ─────────────────────────

export function drawVninRecord(doc: PdfDoc, p: IdentitySlipParams) {
  const f = splitFields(p.fields);
  headerBand(doc, INDIGO, 'vNIN-STYLE VERIFICATION RECORD');
  title(doc, 'Verification Record', 'NIN number withheld for privacy \u2014 safe to share');

  const cardY = 156;
  doc.roundedRect(LEFT, cardY, WIDTH, 176, 8).fill('#ffffff');
  doc.lineWidth(1.2).strokeColor(INDIGO).roundedRect(LEFT, cardY, WIDTH, 176, 8).stroke();

  const photoX = LEFT + 18;
  const photoY = cardY + 18;
  if (!drawPhoto(doc, p.photo, photoX, photoY, 112, 142)) drawPhotoPlaceholder(doc, photoX, photoY, 112, 142);
  doc.lineWidth(1).strokeColor(INDIGO).rect(photoX, photoY, 112, 142).stroke();

  const textX = 190;
  caption(doc, 'Surname', textX, cardY + 20, 235, INDIGO);
  value(doc, f.surname, textX, cardY + 32, 15, 235);
  caption(doc, 'Given names', textX, cardY + 64, 235, INDIGO);
  value(doc, f.givenNames, textX, cardY + 76, 15, 235);
  caption(doc, 'Date of birth', textX, cardY + 112, 140, INDIGO);
  value(doc, f.dob, textX, cardY + 124, 13, 140);
  caption(doc, 'Gender', 340, cardY + 112, 80, INDIGO);
  value(doc, f.gender, 340, cardY + 124, 13, 80);

  drawQr(doc, qrPayload(p.reference), 443, cardY + 20, 98);
  doc.fillColor(GREY).font('Helvetica').fontSize(6.5).text('Scan for K-TECH reference', 443, cardY + 122, { width: 98, align: 'center', lineBreak: false });

  const tableY = 364;
  doc.fillColor(INDIGO).font('Helvetica-Bold').fontSize(10).text('Verification record', LEFT, tableY - 20, { lineBreak: false });
  const cols = [112, 128, 125, 75, 75];
  const headers = ['Timestamp', 'Reference', 'Verification type', 'Status', 'Verified by'];
  const cells = [formatIssued(p.issuedAt), p.reference, 'NIN lookup (NIN withheld)', 'SUCCESSFUL', 'K-TECH SOLUTIONS'];
  let x = LEFT;
  cols.forEach((w, i) => {
    doc.rect(x, tableY, w, 26).fill('#e5e7eb');
    doc.lineWidth(0.6).strokeColor('#6b7280').rect(x, tableY, w, 26).stroke();
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8).text(headers[i], x + 5, tableY + 9, { width: w - 10, lineBreak: false });
    doc.lineWidth(0.6).strokeColor('#6b7280').rect(x, tableY + 26, w, 42).stroke();
    doc.fillColor(i === 3 ? '#166534' : INK).font(i === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).text(cells[i], x + 5, tableY + 33, { width: w - 10, height: 32, ellipsis: true });
    x += w;
  });
  doc.fillColor(GREY).font('Helvetica').fontSize(8.5).text(
    'This record deliberately leaves out the National Identification Number so it can be shared with a third party without exposing it.',
    LEFT, tableY + 86, { width: WIDTH }
  );
  disclaimer(doc, 780);
}

export const renderStandardDigitalSlip = (p: IdentitySlipParams) => buildPdf((doc) => drawStandardDigital(doc, p));
export const renderRegularFormSlip = (p: IdentitySlipParams) => buildPdf((doc) => drawRegularForm(doc, p));
export const renderVninRecordSlip = (p: IdentitySlipParams) => buildPdf((doc) => drawVninRecord(doc, p));
