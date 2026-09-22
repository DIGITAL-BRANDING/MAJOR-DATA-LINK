/**
 * Techhub and FranceVerified return identity-verification results with
 * different, provider-specific field names for the exact same thing (e.g.
 * "firstname" vs "firstName", "telephoneno" vs "mobile" vs "phoneNumber") -
 * see franceverified-slip-adapter.service.ts on the backend for the same
 * problem solved server-side for the generated PDF. This is the
 * client-side equivalent: pick a short, curated set of fields a customer
 * actually cares about (name, photo, phone, gender, ID number, and a
 * couple of location fields) out of whatever the provider actually sent,
 * under one consistent label, instead of dumping every raw key the
 * provider happened to include.
 */

export type IdentityFields = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  idNumber?: string;
  idLabel?: 'NIN' | 'BVN';
  state?: string;
  lga?: string;
  address?: string;
  photo?: string;
};

function pick(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() && value !== '****') return value.trim();
  }
  return undefined;
}

function normaliseGender(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'Male';
  if (v === 'f' || v === 'female') return 'Female';
  return value;
}

/** `idHint` says which ID field to prefer when a raw response has neither
 *  a distinctly-named nin/bvn field (rare, but some FranceVerified shapes
 *  only expose a generic "idNumber") - pass whichever service the customer
 *  actually requested (NIN vs BVN) so the label is never guessed wrong. */
export function extractIdentityFields(data: Record<string, unknown> | undefined, idHint: 'NIN' | 'BVN'): IdentityFields {
  if (!data) return {};

  const photoRaw = pick(data, ['image', 'photo', 'picture', 'passport', 'passport_photo']);

  const nin = pick(data, ['nin']);
  const bvn = pick(data, ['bvn']);
  const genericId = pick(data, ['idNumber', 'id_number']);
  const idNumber = idHint === 'NIN' ? (nin ?? genericId) : (bvn ?? genericId);

  return {
    firstName: pick(data, ['firstname', 'firstName', 'first_name']),
    middleName: pick(data, ['middlename', 'middleName', 'middle_name']),
    lastName: pick(data, ['surname', 'lastName', 'last_name']),
    gender: normaliseGender(pick(data, ['gender'])),
    dateOfBirth: pick(data, ['birthdate', 'dateOfBirth', 'dob', 'birthday', 'date_of_birth']),
    phone: pick(data, ['telephoneno', 'mobile', 'phoneNumber', 'phone', 'phone_number']),
    idNumber,
    idLabel: idNumber ? idHint : undefined,
    state: pick(data, ['residence_state', 'state']),
    lga: pick(data, ['residence_lga', 'lga']),
    address: pick(data, ['residence_AdressLine1', 'address', 'addressLine', 'address_line']),
    photo: normalisePhoto(photoRaw),
  };
}

export function normalisePhoto(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(trimmed)) return trimmed;
  const compact = trimmed.replace(/\s/g, '');
  // Providers return raw JPEG/PNG base64 with no data-URL prefix - never
  // render an arbitrary URL string here, only base64 image bytes.
  if (!/^[a-z0-9+/]+={0,2}$/i.test(compact) || compact.length < 32) return undefined;
  const mime = compact.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${compact}`;
}

/** Ordered (label, value) rows for a details table - skips any field the
 *  provider didn't return rather than showing an empty "N/A" row. */
export function identityFieldRows(fields: IdentityFields): { label: string; value: string }[] {
  const rows: { label: string; value: string | undefined }[] = [
    { label: 'First Name', value: fields.firstName },
    { label: 'Middle Name', value: fields.middleName },
    { label: 'Last Name', value: fields.lastName },
    { label: 'Gender', value: fields.gender },
    { label: 'Date of Birth', value: fields.dateOfBirth },
    { label: 'Phone Number', value: fields.phone },
    { label: fields.idLabel ?? 'ID Number', value: fields.idNumber },
    { label: 'State', value: fields.state },
    { label: 'LGA', value: fields.lga },
    { label: 'Address', value: fields.address },
  ];
  return rows.filter((row): row is { label: string; value: string } => !!row.value);
}
