/**
 * The canonical service contract for conversational clients.
 *
 * This is deliberately a rules engine, not an LLM: a client may only collect
 * listed fields and may only call the declared endpoint after its normal PIN
 * confirmation. New services are added here before a UI exposes them.
 */
export type AssistantField = {
  key: string;
  label: string;
  labelHa: string;
  required: boolean;
  input: 'phone' | 'network' | 'plan' | 'amount' | 'meter' | 'smartcard' | 'text';
};

export type AssistantWorkflow = {
  id: string;
  title: string;
  titleHa: string;
  intents: string[];
  fields: AssistantField[];
  priceLookup?: string;
  purchaseEndpoint?: string;
  status: 'active' | 'guided';
};

export const assistantWorkflows: AssistantWorkflow[] = [
  { id: 'data', title: 'Buy Data', titleHa: 'Siyan Data', intents: ['data', 'bundle', 'sayi min data', 'siyamin data'], fields: [{ key: 'network', label: 'Network', labelHa: 'Network', required: true, input: 'network' }, { key: 'data_type', label: 'Data type', labelHa: 'Nau’in Data', required: true, input: 'text' }, { key: 'phone', label: 'Phone number', labelHa: 'Lambar waya', required: true, input: 'phone' }, { key: 'plan_id', label: 'Data plan', labelHa: 'Data plan', required: true, input: 'plan' }], priceLookup: '/api/data/plans/:network', purchaseEndpoint: '/api/data/purchase', status: 'active' },
  { id: 'airtime', title: 'Buy Airtime', titleHa: 'Siyan Airtime', intents: ['airtime', 'top up', 'topup', 'recharge', 'sayi min airtime'], fields: [{ key: 'network', label: 'Network', labelHa: 'Network', required: true, input: 'network' }, { key: 'phone', label: 'Phone number', labelHa: 'Lambar waya', required: true, input: 'phone' }, { key: 'amount', label: 'Amount', labelHa: 'Kuɗi', required: true, input: 'amount' }], purchaseEndpoint: '/api/airtime/purchase', status: 'active' },
  { id: 'electricity', title: 'Buy Electricity', titleHa: 'Siyan Wutar Lantarki', intents: ['electricity', 'light token', 'wuta', 'lantarki'], fields: [{ key: 'provider', label: 'Distribution company', labelHa: 'Kamfanin wuta', required: true, input: 'text' }, { key: 'meter_number', label: 'Meter number', labelHa: 'Lambar meter', required: true, input: 'meter' }, { key: 'amount', label: 'Amount', labelHa: 'Kuɗi', required: true, input: 'amount' }], purchaseEndpoint: '/api/electricity/purchase', status: 'guided' },
  { id: 'cable', title: 'Cable TV', titleHa: 'Biyan Cable TV', intents: ['cable', 'dstv', 'gotv', 'startimes'], fields: [{ key: 'provider', label: 'Provider', labelHa: 'Provider', required: true, input: 'text' }, { key: 'smartcard', label: 'Smartcard number', labelHa: 'Lambar smartcard', required: true, input: 'smartcard' }, { key: 'plan', label: 'Package', labelHa: 'Package', required: true, input: 'plan' }], purchaseEndpoint: '/api/cable/subscribe', status: 'guided' },
  { id: 'result_pin', title: 'Result Checker PIN', titleHa: 'Result Checker PIN', intents: ['waec', 'neco', 'nabteb', 'result pin'], fields: [{ key: 'exam', label: 'Exam', labelHa: 'Jarabawa', required: true, input: 'text' }], status: 'guided' },
  { id: 'verification', title: 'NIN / BVN Services', titleHa: 'Ayyukan NIN / BVN', intents: ['nin', 'bvn', 'verification'], fields: [{ key: 'service', label: 'Service', labelHa: 'Sabis', required: true, input: 'text' }], status: 'guided' }
];

export function parseAssistantIntent(message: string) {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  let workflow = assistantWorkflows.find((item) => item.intents.some((intent) => normalized.includes(intent)));
  // Restrict separators inside a phone number to spaces/hyphens. Using \D*
  // here would let a number such as "500 zuwa 080..." begin at the zero in
  // 500 and swallow the recipient number as one malformed phone.
  const phoneMatch = normalized.match(/(?<!\d)(?:(?:\+234|234)(?:[\s-]*\d){10}|0(?:[\s-]*\d){10})(?!\d)/);
  const digits = phoneMatch?.[0].replace(/\D/g, '');
  const phone = digits?.startsWith('234') ? `0${digits.slice(3)}` : digits;
  const network = /\bmtn\b/.test(normalized) ? 'MTN' : /\bairtel\b/.test(normalized) ? 'AIRTEL' : /\bglo\b/.test(normalized) ? 'GLO' : /(?:9mobile|nine mobile|etisalat)/.test(normalized) ? '9MOBILE' : undefined;
  const dataSize = normalized.match(/\b\d+(?:\.\d+)?\s*(?:gb|mb)\b/i)?.[0].replace(/\s+/g, '').toUpperCase();
  const dataType = /data\s*coupon|coupon/.test(normalized) ? 'DATA COUPON' : /corporate/.test(normalized) ? 'CORPORATE' : /data\s*share|share/.test(normalized) ? 'DATA SHARE' : /gifting|gift/.test(normalized) ? 'GIFTING' : /sme\s*2|sme2/.test(normalized) ? 'SME2' : /\bsme\b/.test(normalized) ? 'SME' : undefined;
  // A size such as 1GB is an unambiguous data request even when the customer
  // uses only Hausa/English purchase words and never says the word "data".
  if (!workflow && dataSize) workflow = assistantWorkflows.find((item) => item.id === 'data');
  // Remove the recipient first: otherwise the first three digits of 080... can
  // accidentally be interpreted as an airtime amount.
  const withoutPhone = phoneMatch ? normalized.replace(phoneMatch[0], ' ') : normalized;
  const amountMatch = withoutPhone.match(/(?:₦|naira|kudi|kuɗi|amount)\s*(\d{2,6})(?:\.00)?\b|\b(\d{2,6})(?:\.00)?\b/i);
  const amount = amountMatch ? Number(amountMatch[1] ?? amountMatch[2]) : undefined;
  return { workflow: workflow?.id, fields: { ...(network ? { network } : {}), ...(dataType ? { data_type: dataType } : {}), ...(phone?.length === 11 ? { phone } : {}), ...(dataSize ? { data_size: dataSize } : {}), ...(amount ? { amount } : {}) } };
}
