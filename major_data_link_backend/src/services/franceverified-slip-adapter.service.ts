import { renderIdentitySlipPdf, renderPersonalInformationSlipPdf, type IdentitySlipField, type IdentitySlipTier } from '../lib/render-identity-slip-pdf.js';
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
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // FranceVerified masks unavailable private fields with ****. Treat those
  // as absent so neither the customer preview nor generated slip presents a
  // misleading row.
  return trimmed.length > 0 && trimmed !== '****' ? trimmed : undefined;
}

/** FranceVerified uses different casing across its NIN endpoints. */
function firstString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const direct = str(source[key]);
    if (direct) return direct;
    const match = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    if (match) {
      const value = str(source[match]);
      if (value) return value;
    }
  }
  return undefined;
}

function embeddedPhoto(source: Record<string, unknown>): string | undefined {
  const value = firstString(source, 'image', 'photo', 'passport', 'imageBase64');
  // PDFKit accepts bytes/base64, not a remote URL. Keep a URL out of the
  // renderer so a provider-hosted photo can never break PDF generation.
  return value?.startsWith('http://') || value?.startsWith('https://') ? undefined : value;
}

/**
 * Provider schemas vary between endpoints. Only the recognised identity
 * fields are approved for a customer-facing slip and preview; provider
 * operational metadata and nested response objects stay private.
 */
function fieldsFromRaw(
  _data: Record<string, unknown>,
  preferred: IdentitySlipField[]
): IdentitySlipField[] {
  const seen = new Set<string>();
  return preferred.filter((field) => {
    const key = field.label.toLowerCase();
    if (seen.has(key) || field.value === undefined || field.value === null || field.value.trim() === '') return false;
    seen.add(key);
    return true;
  });
}

function hasPersonalInfoFields(fields: IdentitySlipField[]) {
  const values = new Map(fields.map(({ label, value }) => [label.toLowerCase(), value?.trim() ?? '']));
  return Boolean(values.get('first name') && values.get('last name') && values.get('date of birth') && values.get('phone number'));
}

function previewData(fields: IdentitySlipField[], photo?: string): Record<string, string> {
  const data = Object.fromEntries(fields
    .filter((field): field is IdentitySlipField & { value: string } => typeof field.value === 'string' && field.value.trim() !== '')
    .map((field) => [field.label, field.value]));
  if (photo) data.photo = photo;
  return data;
}

async function renderSlip(params: {
  title: 'NIN Slip' | 'BVN Slip';
  subtitle: string;
  reference: string;
  fields: IdentitySlipField[];
  photoBase64?: string;
  tier?: IdentitySlipTier;
  personalInfo?: boolean;
}): Promise<{ pdfBase64: string; userData: Record<string, string> }> {
  const photo = params.photoBase64 ? { base64: params.photoBase64, format: 'jpeg' as const } : undefined;
  const pdfBase64 = params.personalInfo
    ? await renderPersonalInformationSlipPdf({ title: params.title, subtitle: 'Identity details', fields: params.fields, photo, issuedAt: new Date(), tier: params.tier })
    : await renderIdentitySlipPdf({ title: params.title, subtitle: params.subtitle, reference: params.reference, fields: params.fields, photo, issuedAt: new Date(), tier: params.tier });
  return { pdfBase64, userData: previewData(params.fields, params.photoBase64) };
}

export const franceverifiedSlipAdapter = {
  async ninByNin(nin: string, tier?: IdentitySlipTier, personalInfo = false): Promise<TechhubSlipResult> {
    const result = await verifyNin(nin);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const residence = [
      firstString(d, 'residence_AdressLine1', 'residence_address', 'addressLine', 'address_line'),
      firstString(d, 'residence_lga', 'lga', 'localGovernment'),
      firstString(d, 'residence_state', 'state')
    ].filter(Boolean).join(', ');
    const regularFields: IdentitySlipField[] = [
      { label: 'First Name', value: firstString(d, 'firstname', 'firstName') },
      { label: 'Middle Name', value: firstString(d, 'middlename', 'middleName') },
      { label: 'Surname', value: firstString(d, 'surname', 'lastName') },
      { label: 'NIN', value: firstString(d, 'nin', 'idNumber', 'id_number') ?? nin },
      { label: 'Gender', value: titleCaseGender(d.gender) },
      { label: 'Date of Birth', value: str(d.birthdate) },
      { label: 'Phone', value: str(d.telephoneno) },
      { label: 'State of Residence', value: str(d.residence_state) },
      { label: 'LGA of Residence', value: str(d.residence_lga) },
      { label: 'Address', value: str(d.residence_AdressLine1) }
    ];
    const personalInfoFields: IdentitySlipField[] = [
      { label: 'National Identification Number (NIN)', value: firstString(d, 'nin', 'idNumber', 'id_number') ?? nin },
      { label: 'First Name', value: firstString(d, 'firstname', 'firstName') },
      { label: 'Middle Name', value: firstString(d, 'middlename', 'middleName') ?? 'Not returned' },
      { label: 'Last Name', value: firstString(d, 'surname', 'lastName', 'lastname') ?? 'Not returned' },
      { label: 'Maiden Name', value: firstString(d, 'maidenName', 'maiden_name', 'maidenname') ?? 'Not returned' },
      { label: 'Gender', value: titleCaseGender(d.gender) ?? 'Not returned' },
      { label: 'Date of Birth', value: firstString(d, 'birthdate', 'dateOfBirth', 'date_of_birth', 'dob') ?? 'Not returned' },
      { label: 'Phone Number', value: firstString(d, 'telephoneno', 'phoneNumber', 'phone', 'mobile') ?? 'Not returned' },
      { label: 'Residence', value: residence || 'Not returned' }
    ];
    if (personalInfo && (!hasPersonalInfoFields(personalInfoFields) || !embeddedPhoto(d))) {
      return { ok: false, message: 'The provider did not return a complete Personal Info report (identity details and photograph). Please try again later.', raw: result.raw };
    }
    const slip = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by NIN',
      reference,
      photoBase64: embeddedPhoto(d),
      tier,
      personalInfo,
      fields: fieldsFromRaw(d, personalInfo ? personalInfoFields : regularFields)
    });
    return { ok: true, message: result.message, userData: slip.userData, pdfBase64: slip.pdfBase64, raw: result.raw };
  },

  async ninByPhone(phone: string, tier?: IdentitySlipTier, personalInfo = false): Promise<TechhubSlipResult> {
    const result = await verifyNinByPhone(phone);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const address = (d.address as Record<string, unknown> | undefined) ?? {};
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const slip = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by Phone',
      reference,
      photoBase64: embeddedPhoto(d),
      tier,
      personalInfo,
      fields: fieldsFromRaw(d, [
        { label: 'First Name', value: firstString(d, 'firstName', 'firstname') },
        { label: 'Middle Name', value: firstString(d, 'middleName', 'middlename') },
        { label: 'Surname', value: firstString(d, 'lastName', 'surname') },
        // The public FranceVerified phone sample does not promise a NIN.
        // Show it whenever the account returns one, but never invent it.
        { label: 'NIN', value: firstString(d, 'idNumber', 'nin', 'id_number') },
        { label: 'Gender', value: titleCaseGender(d.gender) },
        { label: 'Date of Birth', value: firstString(d, 'dateOfBirth', 'birthdate') },
        { label: 'Phone', value: firstString(d, 'mobile', 'phone', 'phoneNumber') ?? phone },
        { label: 'State', value: firstString(address, 'state') },
        { label: 'Town / LGA', value: firstString(address, 'town', 'lga', 'localGovernment') },
        { label: 'Address', value: firstString(address, 'addressLine', 'address_line', 'line1') },
        { label: 'Birth Country', value: firstString(d, 'birthCountry') },
        { label: 'Birth State', value: firstString(d, 'birthState') },
        { label: 'Birth LGA', value: firstString(d, 'birthLGA') },
        { label: 'Title', value: firstString(d, 'title') },
        { label: 'Education', value: firstString(d, 'educationallevel', 'educationalLevel') },
        { label: 'Employment Status', value: firstString(d, 'employmentstatus', 'employmentStatus') },
        { label: 'Height', value: firstString(d, 'height') },
        { label: 'Marital Status', value: firstString(d, 'maritalstatus', 'maritalStatus') }
      ])
    });
    return { ok: true, message: result.message, userData: slip.userData, pdfBase64: slip.pdfBase64, raw: result.raw };
  },

  async ninByDemographic(params: { firstname: string; lastname: string; dob: string; gender?: string }): Promise<TechhubSlipResult> {
    const result = await verifyNinByDemographic(params);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = str(d.trackingId) ?? `FV-${Date.now()}`;
    const slip = await renderSlip({
      title: 'NIN Slip',
      subtitle: 'Verified by Demographic Details',
      reference,
      photoBase64: str(d.image ?? d.photo),
      fields: fieldsFromRaw(d, [
        { label: 'First Name', value: str(d.firstname ?? d.firstName) ?? params.firstname },
        { label: 'Middle Name', value: str(d.middlename ?? d.middleName) },
        { label: 'Surname', value: str(d.surname ?? d.lastName) ?? params.lastname },
        { label: 'NIN', value: str(d.nin ?? d.idNumber) },
        { label: 'Gender', value: titleCaseGender(d.gender) ?? titleCaseGender(params.gender) },
        { label: 'Date of Birth', value: str(d.birthdate ?? d.dateOfBirth) ?? params.dob }
      ])
    });
    return { ok: true, message: result.message, userData: slip.userData, pdfBase64: slip.pdfBase64, raw: result.raw };
  },

  async bvnSlip(bvn: string, tier?: IdentitySlipTier): Promise<TechhubSlipResult> {
    const result = await verifyBvn(bvn);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = `FV-${Date.now()}`;
    const slip = await renderSlip({
      title: 'BVN Slip',
      subtitle: 'Verified by BVN',
      reference,
      photoBase64: str(d.photo),
      tier,
      fields: fieldsFromRaw(d, [
        { label: 'First Name', value: str(d.firstName) },
        { label: 'Middle Name', value: str(d.middleName) },
        { label: 'Surname', value: str(d.lastName) },
        { label: 'BVN', value: str(d.bvn) ?? bvn },
        { label: 'Gender', value: str(d.gender) },
        { label: 'Date of Birth', value: str(d.birthday) },
        { label: 'Phone', value: str(d.phoneNumber) },
        { label: 'Name on Card', value: str(d.nameOnCard) }
      ])
    });
    return { ok: true, message: result.message, userData: slip.userData, pdfBase64: slip.pdfBase64, raw: result.raw };
  },

  /** FranceVerified's /bvn/verify/phone doc doesn't publish a full sample body - field names are best-effort from their "Returned Information" list; confirm against a live response and adjust if any come back empty. */
  async bvnSlipByPhone(phone: string): Promise<TechhubSlipResult> {
    const result = await verifyBvnByPhone(phone);
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message, raw: result.raw };
    }
    const d = result.data as Record<string, unknown>;
    const reference = `FV-${Date.now()}`;
    const slip = await renderSlip({
      title: 'BVN Slip',
      subtitle: 'Verified by Phone',
      reference,
      photoBase64: str(d.photo),
      fields: fieldsFromRaw(d, [
        { label: 'First Name', value: str(d.firstName) },
        { label: 'Middle Name', value: str(d.middleName) },
        { label: 'Surname', value: str(d.lastName) },
        { label: 'BVN', value: str(d.bvn) },
        { label: 'Date of Birth', value: str(d.birthday ?? d.dateOfBirth) },
        { label: 'Phone', value: str(d.phoneNumber) ?? phone }
      ])
    });
    return { ok: true, message: result.message, userData: slip.userData, pdfBase64: slip.pdfBase64, raw: result.raw };
  }
};
