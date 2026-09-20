import PDFDocument from 'pdfkit';

/**
 * Renders a NIN/BVN slip PDF from plain identity fields - for providers
 * (currently FranceVerified) that return JSON data only, no ready-made PDF.
 * Techhub-issued slips already arrive as a finished pdfBase64 and never go
 * through this; this exists so switching a service's provider (see the
 * `provider` column on ServicePricing) never changes what the customer gets
 * to download - same "one PDF per slip purchase" shape either way.
 *
 * Same pdfkit conventions as nin-modification.service.ts's
 * renderModificationPdf() (A4, 50pt margin, Helvetica, base64 via
 * chunks/end) - kept as its own file since both verification.service.ts's
 * slip flow and, if it ever needs one, a future BVN-only flow can reuse it.
 */

export type IdentitySlipPhoto = { base64: string; format?: 'jpeg' | 'png' };

export type IdentitySlipField = { label: string; value: string | null | undefined };

/**
 * Only meaningful for providers (FranceVerified) whose own API has no real
 * premium/standard distinction - see franceverified-slip-adapter.ts. Both
 * tiers render from the exact same underlying data; this only changes the
 * PDF's visual presentation, so a customer who paid for "Premium" still
 * gets a document that looks worth the extra cost even though FranceVerified
 * itself never distinguished the two. Techhub-issued slips never pass
 * through here at all (they arrive as a finished pdfBase64), so this only
 * affects the FranceVerified path.
 */
export type IdentitySlipTier = 'premium' | 'standard';

const pageLeft = 50;
const pageRight = 545;
const GOLD = '#b98a2c';
const GOLD_DARK = '#7a5a17';
const INK = '#171106';

function valueForPdf(value: string | null | undefined): string {
  return value === undefined || value === null || value.trim() === '' || value === '****' ? 'N/A' : value;
}

/** Accept either raw base64 or a browser-friendly data URL from a provider. */
function imageBuffer(value: string): Buffer {
  const base64 = value
    .trim()
    .replace(/^data:image\/(?:png|jpe?g|webp);base64,/i, '')
    .replace(/\s/g, '');
  return Buffer.from(base64, 'base64');
}

export function renderIdentitySlipPdf(params: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  fields: IdentitySlipField[];
  photo?: IdentitySlipPhoto;
  issuedAt: Date;
  /** Defaults to 'standard' (today's existing look) when omitted, so any
   *  caller that doesn't care about tiers keeps behaving exactly as before. */
  tier?: IdentitySlipTier;
}): Promise<string> {
  return params.tier === 'premium' ? renderPremiumSlip(params) : renderStandardSlip(params);
}

export function renderPersonalInformationSlipPdf(params: {
  title: 'NIN Slip' | 'BVN Slip'; subtitle: string; reference: string;
  fields: IdentitySlipField[]; photo?: IdentitySlipPhoto; issuedAt: Date; tier?: IdentitySlipTier;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);

    const left = 46; const right = 549; const width = right - left;
    doc.rect(left, 45, width, 76).fill('#102a5c');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('MAJOR DATA-LINK', left + 20, 65);
    doc.font('Helvetica').fontSize(9).text('Verified identity service', left + 20, 91);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(17).text('Personal Information Slip', left, 144, { width, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`${params.title} - ${params.subtitle}`, left, 168, { width, align: 'center' });

    const photoX = left; const photoY = 210; const photoWidth = 175; const photoHeight = 220;
    doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#f4f6f8');
    if (params.photo) {
      try { doc.image(imageBuffer(params.photo.base64), photoX, photoY, { fit: [photoWidth, photoHeight], align: 'center', valign: 'center' }); }
      catch (error) { console.error('[identity-slip-pdf] failed to embed photo, continuing without it:', error); }
    } else {
      doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('No photograph returned', photoX, photoY + 100, { width: photoWidth, align: 'center' });
    }

    const tableX = photoX + photoWidth + 22; const tableWidth = right - tableX; const labelWidth = Math.min(135, tableWidth * .46);
    let y = photoY;
    doc.rect(tableX, y, tableWidth, 31).fill('#eef2f7').strokeColor('#94a3b8').lineWidth(.5).stroke();
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(12).text('Personal Information', tableX, y + 9, { width: tableWidth, align: 'center' }); y += 31;
    const rows: IdentitySlipField[] = [{ label: 'Reference', value: params.reference }, ...params.fields];
    for (const field of rows) {
      const value = valueForPdf(field.value); const valueWidth = tableWidth - labelWidth - 16;
      const height = Math.max(29, doc.heightOfString(value, { width: valueWidth, lineGap: 2 }) + 14);
      doc.rect(tableX, y, labelWidth, height).fill('#f8fafc'); doc.rect(tableX + labelWidth, y, tableWidth - labelWidth, height).fill('#ffffff');
      doc.rect(tableX, y, tableWidth, height).lineWidth(.5).strokeColor('#94a3b8').stroke();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8.5).text(field.label, tableX + 7, y + 9, { width: labelWidth - 14 });
      doc.fillColor('#111111').font('Helvetica').fontSize(8.5).text(value, tableX + labelWidth + 8, y + 9, { width: valueWidth, lineGap: 2 }); y += height;
    }
    const footerY = Math.max(y, photoY + photoHeight) + 35;
    doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`Generated ${params.issuedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')} from provider-verified data. This is not an official NIMC or NIBSS-issued identity document.`, left, footerY, { width, align: 'center' });
    doc.end();
  });
}

function renderStandardSlip(params: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  fields: IdentitySlipField[];
  photo?: IdentitySlipPhoto;
  issuedAt: Date;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);

    doc.rect(pageLeft, 50, pageRight - pageLeft, 72).fill('#102a5c');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('K-TECH SOLUTIONS', pageLeft + 20, 70);
    doc.font('Helvetica').fontSize(9).text('Identity verification result', pageLeft + 20, 94);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(14).text(
      `${params.title} successfully verified`,
      pageLeft,
      145,
      { width: pageRight - pageLeft, align: 'center' }
    );
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(params.subtitle, pageLeft, 165, {
      width: pageRight - pageLeft,
      align: 'center'
    });

    const photoX = pageLeft;
    const photoY = 210;
    const photoWidth = 170;
    const photoHeight = 205;
    let hasPhoto = false;
    if (params.photo) {
      try {
        doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#f3f4f6');
        doc.image(imageBuffer(params.photo.base64), photoX, photoY, { fit: [photoWidth, photoHeight], align: 'center', valign: 'center' });
        hasPhoto = true;
      } catch (error) {
        console.error('[identity-slip-pdf] failed to embed photo, continuing without it:', error);
      }
    }

    const tableX = hasPhoto ? photoX + photoWidth + 24 : pageLeft;
    const tableWidth = pageRight - tableX;
    const labelWidth = Math.min(140, tableWidth * 0.39);
    let y = photoY;
    const rows: IdentitySlipField[] = [
      { label: 'Reference', value: params.reference },
      { label: 'Issued', value: params.issuedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') },
      ...params.fields
    ];

    for (const field of rows) {
      const value = valueForPdf(field.value);
      const valueHeight = doc.heightOfString(value, { width: tableWidth - labelWidth - 16, lineGap: 2 });
      const rowHeight = Math.max(29, valueHeight + 14);
      if (y + rowHeight > 760) {
        doc.addPage();
        y = 60;
      }
      doc.rect(tableX, y, labelWidth, rowHeight).fill('#eef2f7');
      doc.rect(tableX + labelWidth, y, tableWidth - labelWidth, rowHeight).fill('#ffffff');
      doc.rect(tableX, y, tableWidth, rowHeight).lineWidth(0.5).strokeColor('#94a3b8').stroke();
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9).text(field.label, tableX + 9, y + 9, { width: labelWidth - 18 });
      doc.font('Helvetica').text(value, tableX + labelWidth + 8, y + 9, { width: tableWidth - labelWidth - 16, lineGap: 2 });
      y += rowHeight;
    }

    const footerY = Math.max(y + 18, hasPhoto ? photoY + photoHeight + 20 : y + 18);
    doc.fillColor('#6b7280').fontSize(8).text(
      'Generated by K-TECH SOLUTIONS from verified provider data. This is not a NIMC/NIBSS-issued document.',
      pageLeft,
      footerY,
      { width: pageRight - pageLeft, align: 'center' }
    );

    doc.end();
  });
}

/**
 * Same data as renderStandardSlip - richer presentation only: a gold
 * double-frame border, a "PREMIUM SLIP" ribbon badge, a diagonal
 * watermark, and gold-accented rows instead of plain grey/white.
 */
function renderPremiumSlip(params: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  fields: IdentitySlipField[];
  photo?: IdentitySlipPhoto;
  issuedAt: Date;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);

    function frame() {
      doc.lineWidth(1.5).strokeColor(GOLD).rect(24, 24, 547, 793).stroke();
      doc.lineWidth(0.6).strokeColor(GOLD).rect(30, 30, 535, 781).stroke();
    }

    // Diagonal watermark, laid down first so every later fill sits on top of it.
    doc.save();
    doc.rotate(-38, { origin: [297, 421] });
    doc.fontSize(64).font('Helvetica-Bold').fillColor('#f1e7cf').text('PREMIUM VERIFIED', 60, 390, { width: 480, align: 'center' });
    doc.restore();

    frame();

    doc.rect(pageLeft, 50, pageRight - pageLeft, 78).fill(INK);
    doc.rect(pageLeft, 50, pageRight - pageLeft, 4).fill(GOLD);
    doc.fillColor('#ffe9a3').font('Helvetica-Bold').fontSize(18).text('K-TECH SOLUTIONS', pageLeft + 20, 74);
    doc.font('Helvetica').fontSize(9).fillColor('#d8c58b').text('Premium Identity Verification', pageLeft + 20, 98);

    const badgeW = 118;
    const badgeX = pageRight - badgeW - 16;
    doc.roundedRect(badgeX, 62, badgeW, 22, 11).fill(GOLD);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('PREMIUM SLIP', badgeX, 68, { width: badgeW, align: 'center' });

    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(15).text(`${params.title} \u2014 Successfully Verified`, pageLeft, 150, {
      width: pageRight - pageLeft,
      align: 'center'
    });
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(GOLD_DARK).text(params.subtitle, pageLeft, 170, { width: pageRight - pageLeft, align: 'center' });
    doc.moveTo(pageLeft + 140, 188).lineTo(pageRight - 140, 188).lineWidth(1).strokeColor(GOLD).stroke();

    const photoX = pageLeft;
    const photoY = 205;
    const photoWidth = 170;
    const photoHeight = 205;
    let hasPhoto = false;
    if (params.photo) {
      try {
        doc.lineWidth(2).strokeColor(GOLD).rect(photoX - 3, photoY - 3, photoWidth + 6, photoHeight + 6).stroke();
        doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#f8f4e8');
        doc.image(imageBuffer(params.photo.base64), photoX, photoY, { fit: [photoWidth, photoHeight], align: 'center', valign: 'center' });
        hasPhoto = true;
      } catch (error) {
        console.error('[identity-slip-pdf] failed to embed photo, continuing without it:', error);
      }
    }

    const tableX = hasPhoto ? photoX + photoWidth + 24 : pageLeft;
    const tableWidth = pageRight - tableX;
    const labelWidth = Math.min(140, tableWidth * 0.39);
    let y = photoY;
    const rows: IdentitySlipField[] = [
      { label: 'Reference', value: params.reference },
      { label: 'Issued', value: params.issuedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') },
      ...params.fields
    ];

    for (const field of rows) {
      const value = valueForPdf(field.value);
      const valueHeight = doc.heightOfString(value, { width: tableWidth - labelWidth - 16, lineGap: 2 });
      const rowHeight = Math.max(29, valueHeight + 14);
      if (y + rowHeight > 740) {
        doc.addPage();
        frame();
        y = 60;
      }
      doc.rect(tableX, y, labelWidth, rowHeight).fill('#f6efdc');
      doc.rect(tableX + labelWidth, y, tableWidth - labelWidth, rowHeight).fill('#fffdf7');
      doc.lineWidth(0.6).strokeColor(GOLD).rect(tableX, y, tableWidth, rowHeight).stroke();
      doc.fillColor(GOLD_DARK).font('Helvetica-Bold').fontSize(9).text(field.label, tableX + 9, y + 9, { width: labelWidth - 18 });
      doc.fillColor('#111111').font('Helvetica').text(value, tableX + labelWidth + 8, y + 9, { width: tableWidth - labelWidth - 16, lineGap: 2 });
      y += rowHeight;
    }

    const footerY = Math.max(y + 20, hasPhoto ? photoY + photoHeight + 22 : y + 20);
    doc.moveTo(pageLeft + 60, footerY).lineTo(pageRight - 60, footerY).lineWidth(0.75).strokeColor(GOLD).stroke();
    doc.fillColor(GOLD_DARK).font('Helvetica-Bold').fontSize(8).text(
      'PREMIUM VERIFIED \u2014 issued by K-TECH SOLUTIONS from verified provider data. Not a NIMC/NIBSS-issued document.',
      pageLeft,
      footerY + 8,
      { width: pageRight - pageLeft, align: 'center' }
    );

    doc.end();
  });
}
