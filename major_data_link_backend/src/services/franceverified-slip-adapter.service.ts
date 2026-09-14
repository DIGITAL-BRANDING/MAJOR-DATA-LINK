import { renderIdentitySlipPdf, type IdentitySlipField } from '../lib/render-identity-slip-pdf.js';
import { verifyNin, verifyNinByPhone, verifyNinByDemographic } from './franceverified/nin.service.js';
import { verifyBvn, verifyBvnByPhone } from './franceverified/bvn.service.js';
import type { TechhubSlipResult } from './techhub.service.js';

/**
 * Adapts FranceVerified's raw JSON-only nin.service.ts/bvn.service.ts calls
 * to look exactly like a Techhub slip call (TechhubSlipResult: ok/message/
 * userData/pdfBase64/raw) by rendering the PDF ourselves from the returned
 * fields - see the "PDF vs JSON-only" decision this implements.
 *
 * Every function here returns Promise<TechhubSlipResult>, matching
 * techhubService's method signatures 1:1, so verification.service.ts's
 * dispatch can pick either { ok: () => techhubService.ninByNin(nin, tier),
 * franceverified: () => franceverifiedSlipAdapter.ninByNin(nin) } and treat
 * the result identically either way.
 *
 * Field-name mapping note: FranceVerified's /nin/verify/nin and
 * /nin/verify/phone responses use DIFFERENT casing/keys for the same thing
 * (image vs photo, nin vs idNumber, birthdate vs dateOfBirth, gender m/f vs
 * Male/Female) - each function below reads whichever key that specific
 * endpoint actually returns, per its own doc sample.
 */

function titleCaseGender(value: unknown): string | undefined {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (v === 'm' || v === 'male') return 'Male';
  if (v === 'f' || v === 'female') return 'Female';
  return typeof value === 'string' && value ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function renderSlip(params: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  fields: IdentitySlipField[];
  photoBase64?: string;
}) {
  return renderIdentitySlipPdf({
    title: params.title,
    subtitle: params.subtitle,
    reference: params.reference,
    fields: params.fields,
    photo: params.photoBase64 ? { base64: params.photoBase64, format: 'jpeg' } : undefined,
    issuedAt: new Date()
  });
}

export const franceverifiedSlipAdapter = {
  async ninByNin(nin: string): Promise<TechhubSlipResult> {
    const result = await verifyNin(nin);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const pdfBase64 = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by NIN',
      reference,
      photoBase64: str(d.image),
      fields: [
        { label: 'First Name', value: str(d.firstname) },
        { label: 'Middle Name', value: str(d.middlename) },
        { label: 'Surname', value: str(d.surname) },
        { label: 'NIN', value: str(d.nin) ?? nin },
        { label: 'Gender', value: titleCaseGender(d.gender) },
        { label: 'Date of Birth', value: str(d.birthdate) },
        { label: 'Phone', value: str(d.telephoneno) },
        { label: 'State of Residence', value: str(d.residence_state) },
        { label: 'LGA of Residence', value: str(d.residence_lga) },
        { label: 'Address', value: str(d.residence_AdressLine1) }
      ]
    });
    return { ok: true, message: result.message, userData: d, pdfBase64, raw: result.raw };
  },

  async ninByPhone(phone: string): Promise<TechhubSlipResult> {
    const result = await verifyNinByPhone(phone);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const address = (d.address as Record<string, unknown> | undefined) ?? {};
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const pdfBase64 = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by Phone',
      reference,
      photoBase64: str(d.photo),
      fields: [
        { label: 'First Name', value: str(d.firstName) },
        { label: 'Middle Name', value: str(d.middleName) },
        { label: 'Surname', value: str(d.lastName) },
        { label: 'NIN', value: str(d.idNumber) },
        { label: 'Gender', value: titleCaseGender(d.gender) },
        { label: 'Date of Birth', value: str(d.dateOfBirth) },
        { label: 'Phone', value: str(d.mobile) ?? phone },
        { label: 'State', value: str(address.state) },
        { label: 'LGA', value: str(address.lga) },
        { label: 'Address', value: str(address.addressLine) }
      ]
    });
    return { ok: true, message: result.message, userData: d, pdfBase64, raw: result.raw };
  },

  async ninByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }): Promise<TechhubSlipResult> {
    const result = await verifyNinByDemographic(params);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const pdfBase64 = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by Demographic Details',
      reference,
      photoBase64: str(d.image ?? d.photo),
      fields: [
        { label: 'First Name', value: str(d.firstname ?? d.firstName) ?? params.firstname },
        { label: 'Middle Name', value: str(d.middlename ?? d.middleName) },
        { label: 'Surname', value: str(d.surname ?? d.lastName) ?? params.lastname },
        { label: 'NIN', value: str(d.nin ?? d.idNumber) },
        { label: 'Gender', value: titleCaseGender(d.gender) ?? titleCaseGender(params.gender) },
        { label: 'Date of Birth', value: str(d.birthdate ?? d.dateOfBirth) ?? params.dob }
      ]
    });
    return { ok: true, message: result.message, userData: d, pdfBase64, raw: result.raw };
  },

  async bvnSlip(bvn: string): Promise<TechhubSlipResult> {
    const result = await verifyBvn(bvn);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = `FV-${Date.now()}`;
    const pdfBase64 = await renderSlip({
      title: 'BVN Slip',
      subtitle: 'Verified by BVN',
      reference,
      photoBase64: str(d.photo),
      fields: [
        { label: 'First Name', value: str(d.firstName) },
        { label: 'Middle Name', value: str(d.middleName) },
        { label: 'Surname', value: str(d.lastName) },
        { label: 'BVN', value: str(d.bvn) ?? bvn },
        { label: 'Gender', value: str(d.gender) },
        { label: 'Date of Birth', value: str(d.birthday) },
        { label: 'Phone', value: str(d.phoneNumber) },
        { label: 'Name on Card', value: str(d.nameOnCard) }
      ]
    });
    return { ok: true, message: result.message, userData: d, pdfBase64, raw: result.raw };
  },

  /** FranceVerified's /bvn/verify/phone doc doesn't publish a full sample body - field names are best-effort from their "Returned Information" list; confirm against a live response and adjust if any come back empty. */
  async bvnSlipByPhone(phone: string): Promise<TechhubSlipResult> {
    const result = await verifyBvnByPhone(phone);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = `FV-${Date.now()}`;
    const pdfBase64 = await renderSlip({
      title: 'BVN Slip',
      subtitle: 'Verified by Phone',
      reference,
      photoBase64: str(d.photo),
      fields: [
        { label: 'First Name', value: str(d.firstName) },
        { label: 'Middle Name', value: str(d.middleName) },
        { label: 'Surname', value: str(d.lastName) },
        { label: 'BVN', value: str(d.bvn) },
        { label: 'Date of Birth', value: str(d.birthday ?? d.dateOfBirth) },
        { label: 'Phone', value: str(d.phoneNumber) ?? phone }
      ]
    });
    return { ok: true, message: result.message, userData: d, pdfBase64, raw: result.raw };
  }
};
