import PDFDocument from 'pdfkit';
import {
  drawQr,
  imageBuffer,
  qrPayload,
  valueForPdf,
  type IdentitySlipField,
  type IdentitySlipParams,
  type IdentitySlipPhoto,
  type IdentitySlipTier
} from './identity-slip-common.js';
import { renderPremiumPortraitSlip, renderRegularFormSlip, renderSmartIdCardSlip, renderStandardDigitalSlip, renderVninRecordSlip } from './identity-slip-layouts.js';

/**
 * Renders a NIN/BVN slip PDF from plain identity fields - for providers
 * (currently FranceVerified) that return JSON data only, no ready-made PDF.
 * Techhub-issued slips already arrive as a finished pdfBase64 and never go
 * through this; this exists so switching a service's provider (see the
 * `provider` column on ServicePricing) never changes what the customer gets
 * to download - same "one PDF per slip purchase" shape either way.
 *
 * NIN slips pick one of six layouts by tier (premium here; standard,
 * regular, vnin, smart and portrait in identity-slip-layouts.ts). BVN slips keep their
 * original premium/standard looks. Tier only changes presentation - every
 * layout is built from the same provider data.
 */

export type { IdentitySlipField, IdentitySlipPhoto, IdentitySlipTier };

const pageLeft = 50;
const pageRight = 545;
const GOLD = '#b98a2c';
const GOLD_DARK = '#7a5a17';
const INK = '#171106';

export function renderIdentitySlipPdf(params: IdentitySlipParams): Promise<string> {
  if (params.title === 'NIN Slip') {
    switch (params.tier) {
      case 'premium':
        return renderPremiumSlip(params);
      case 'standard':
        return renderStandardDigitalSlip(params);
      case 'regular':
        return renderRegularFormSlip(params);
      case 'vnin':
        return renderVninRecordSlip(params);
      case 'smart':
        return renderSmartIdCardSlip(params);
      case 'portrait':
        return renderPremiumPortraitSlip(params);
      default:
        // No tier given: the original plain look.
        return renderStandardSlip(params);
    }
  }
  // BVN slips only ever had the two original looks.
  return params.tier === 'premium' ? renderPremiumSlip(params) : renderStandardSlip(params);
}

export function renderPersonalInformationSlipPdf(params: {
  title: 'NIN Slip' | 'BVN Slip'; subtitle: string;
  fields: IdentitySlipField[]; photo?: IdentitySlipPhoto; issuedAt: Date; tier?: IdentitySlipTier;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
    doc.on('error', reject);

    const left = 40; const right = 555; const width = right - left;
    doc.rect(left, 40, width, 66).fill('#102a5c');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text('K-TECH SOLUTIONS', left + 17, 56);
    doc.font('Helvetica').fontSize(8.5).text('Third-party identity verification report', left + 17, 81);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(16).text('Personal Information Report', left, 125, { width, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(`${params.title} - Identity details`, left, 147, { width, align: 'center' });

    const photoX = left; const photoY = 178; const photoWidth = 180; const photoHeight = 225;
    doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#f4f6f8').strokeColor('#cbd5e1').lineWidth(.6).stroke();
    if (params.photo) {
      try { doc.image(imageBuffer(params.photo.base64), photoX + 1, photoY + 1, { fit: [photoWidth - 2, photoHeight - 2], align: 'center', valign: 'center' }); }
      catch (error) { console.error('[identity-slip-pdf] failed to embed photo, continuing without it:', error); }
    } else {
      doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('No photograph returned', photoX, photoY + 100, { width: photoWidth, align: 'center' });
    }

    const tableX = photoX + photoWidth + 18; const tableWidth = right - tableX; const labelWidth = Math.min(130, tableWidth * .46);
    let y = photoY;
    doc.rect(tableX, y, tableWidth, 30).fill('#eef2f7').strokeColor('#94a3b8').lineWidth(.5).stroke();
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(11).text('Personal Information', tableX, y + 8, { width: tableWidth, align: 'center' }); y += 30;
    const rows: IdentitySlipField[] = params.fields;
    for (const field of rows) {
      const value = valueForPdf(field.value); const valueWidth = tableWidth - labelWidth - 14;
      const height = Math.max(27, doc.heightOfString(value, { width: valueWidth, lineGap: 2 }) + 12);
      doc.rect(tableX, y, labelWidth, height).fill('#f8fafc'); doc.rect(tableX + labelWidth, y, tableWidth - labelWidth, height).fill('#ffffff');
      doc.rect(tableX, y, tableWidth, height).lineWidth(.5).strokeColor('#94a3b8').stroke();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text(field.label, tableX + 7, y + 8, { width: labelWidth - 14 });
      doc.fillColor('#111111').font('Helvetica').fontSize(8).text(value, tableX + labelWidth + 7, y + 8, { width: valueWidth, lineGap: 2 }); y += height;
    }
    const footerY = Math.max(y, photoY + photoHeight) + 24;
    doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`Generated ${params.issuedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')}`, left, footerY, { width, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#7a5a17').text('This third-party report is not issued or certified by NIMC.', left, footerY + 16, { width, align: 'center' });
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

    // Premium NIN slips carry a QR of our reference in the free space under
    // the photo (the field table sits to the right of the photo, so there is
    // no collision). Skipped without a photo, where the table is full width.
    if (hasPhoto && params.title === 'NIN Slip') {
      const qrSize = 110;
      const qrX = photoX + (photoWidth - qrSize) / 2;
      const qrY = photoY + photoHeight + 24;
      doc.lineWidth(0.8).strokeColor(GOLD).rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).stroke();
      drawQr(doc, qrPayload(params.reference), qrX, qrY, qrSize);
      doc.fillColor(GOLD_DARK).font('Helvetica-Bold').fontSize(7).text('SCAN FOR K-TECH REFERENCE', photoX, qrY + qrSize + 10, { width: photoWidth, align: 'center', lineBreak: false });
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
