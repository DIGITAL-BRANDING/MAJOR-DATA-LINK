import {
  Wifi,
  Smartphone,
  ArrowLeftRight,
  Tv,
  Zap,
  GraduationCap,
  ClipboardList,
  MessageSquare,
  Ticket,
  CreditCard,
  IdCard,
  Fingerprint,
  Briefcase,
  ShieldCheck,
  Receipt,
  Phone,
  Search,
  MapPin,
  Unlink,
  FilePenLine,
  Baby,
  Newspaper,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type ServiceTint = 'gold' | 'bronze' | 'ember' | 'success' | 'ink';

export type ServiceItem = {
  label: string;
  /** Short, plain-language explanation shown on the coming-soon page and
   *  as a tooltip-ish subtitle — written for a first-time customer, not a
   *  developer. */
  description: string;
  icon: LucideIcon;
  route: string;
  tint: ServiceTint;
  /** false = tile still shows and is clickable, but leads to a friendly
   *  "coming soon on web" page instead of a dead link — mirrors the
   *  Flutter app's ComingSoonScreen for the same not-yet-built services
   *  (see major_data_link/lib/core/router/app_router.dart). */
  implemented: boolean;
};

// Mirrors the service list in
// major_data_link/lib/features/home/presentation/screens/services_screen.dart
// — same order, same set — so a customer moving between the app and the
// website sees one consistent menu.
export const SERVICES: ServiceItem[] = [
  { label: 'NIN Phone Verification', description: 'Verify a NIN using the registered phone number.', icon: IdCard, route: '/nin', tint: 'gold', implemented: true },
  { label: 'Phone Multiple', description: 'Find identity details using a registered phone number.', icon: Phone, route: '/phone', tint: 'bronze', implemented: true },
  { label: 'CAC Services', description: 'Request CAC registration or verification and receive completed files.', icon: Briefcase, route: '/cac', tint: 'success', implemented: true },
  { label: 'BVN Verification', description: 'Generate a BVN verification slip.', icon: Fingerprint, route: '/bvn', tint: 'ember', implemented: true },
  { label: 'IPE Clearance (Instant)', description: 'Submit a tracking ID for instant IPE clearance.', icon: ShieldCheck, route: '/ipe', tint: 'gold', implemented: true },
  { label: 'Validation', description: 'Submit a NIN record validation request.', icon: ClipboardList, route: '/validation', tint: 'bronze', implemented: true },
  { label: 'Personalization', description: 'Process a NIN personalization tracking request.', icon: MapPin, route: '/tracking', tint: 'success', implemented: true },
  { label: 'BVN Retrieval', description: 'Retrieve BVN details using name and registered phone number.', icon: Search, route: '/bvn-ret', tint: 'ember', implemented: true },
  { label: 'Self Service Unlink', description: 'Submit an identity delinking request.', icon: Unlink, route: '/delink', tint: 'gold', implemented: true },
  { label: 'NIN Modifications', description: 'Request corrections to NIN records.', icon: FilePenLine, route: '/nin-modification', tint: 'bronze', implemented: true },
  { label: 'Birth Attestation', description: 'Submit a birth attestation request for manual processing.', icon: Baby, route: '/attestation', tint: 'success', implemented: true },
  { label: 'TIN Certificate', description: 'Request a TIN certificate and receive it in Deliveries.', icon: Receipt, route: '/tin', tint: 'ember', implemented: true },
  { label: 'Newspaper Publication', description: 'Submit a newspaper publication request.', icon: Newspaper, route: '/newspaper', tint: 'gold', implemented: true },
  { label: 'Demographic Search', description: 'Search NIN records using demographic details.', icon: Search, route: '/demo', tint: 'bronze', implemented: true },
  { label: 'BVN Licence Creation', description: 'Create a BVN licence onboarding request.', icon: Fingerprint, route: '/bvn-license', tint: 'gold', implemented: true },
  { label: 'BVN Modification', description: 'Submit a BVN modification request for processing.', icon: FilePenLine, route: '/bvn-modification', tint: 'bronze', implemented: true },
  { label: 'BVN CRM', description: 'Submit a BVN CRM Ticket ID for follow-up.', icon: Settings2, route: '/bvn-crm', tint: 'gold', implemented: true },
  {
    label: 'Buy Data',
    description: 'Get data bundles for MTN, Glo, Airtel or 9mobile, delivered instantly.',
    icon: Wifi,
    route: '/buy-data',
    tint: 'gold',
    implemented: true,
  },
  {
    label: 'Buy Airtime',
    description: 'Top up any Nigerian network in seconds.',
    icon: Smartphone,
    route: '/buy-airtime',
    tint: 'bronze',
    implemented: true,
  },
  {
    label: 'Airtime to Cash',
    description: 'Convert excess airtime back into your wallet balance.',
    icon: ArrowLeftRight,
    route: '/airtime-to-cash',
    tint: 'success',
    implemented: false,
  },
  {
    label: 'Cable TV',
    description: 'Renew DStv, GOtv or Startimes subscriptions.',
    icon: Tv,
    route: '/cable-tv',
    tint: 'ember',
    implemented: false,
  },
  {
    label: 'Electricity',
    description: 'Buy prepaid or postpaid electricity tokens.',
    icon: Zap,
    route: '/electricity',
    tint: 'gold',
    implemented: false,
  },
  {
    label: 'Result Checkers',
    description: 'Buy WAEC, NECO or NABTEB result checker PINs.',
    icon: GraduationCap,
    route: '/result-checkers',
    tint: 'bronze',
    implemented: true,
  },
  {
    label: 'JAMB Services',
    description: 'Request JAMB result, admission and O-level services securely.',
    icon: ClipboardList,
    route: '/jamb-services',
    tint: 'ember',
    implemented: true,
  },
  {
    label: 'Bulk SMS',
    description: 'Send SMS to many recipients at once.',
    icon: MessageSquare,
    route: '/bulk-sms',
    tint: 'success',
    implemented: false,
  },
  {
    label: 'Recharge Card',
    description: 'Print recharge card PINs in bulk.',
    icon: Ticket,
    route: '/recharge-card',
    tint: 'gold',
    implemented: false,
  },
  {
    label: 'Data Card',
    description: 'Print data card PINs in bulk.',
    icon: CreditCard,
    route: '/data-card',
    tint: 'bronze',
    implemented: false,
  },
  {
    label: 'NIN Services',
    description: 'NIN slips, validation and related lookups.',
    icon: IdCard,
    route: '/nin-services',
    tint: 'ink',
    implemented: true,
  },
  {
    label: 'BVN Services',
    description: 'BVN slips and lookups.',
    icon: Fingerprint,
    route: '/bvn-services',
    tint: 'ember',
    implemented: true,
  },
  {
    label: 'CAC Registration',
    description: 'Register a business name with CAC.',
    icon: Briefcase,
    route: '/cac-registration',
    tint: 'success',
    implemented: false,
  },
  {
    label: 'SCUML Registration',
    description: 'SCUML registration for regulated businesses.',
    icon: ShieldCheck,
    route: '/scuml-registration',
    tint: 'gold',
    implemented: false,
  },
  {
    label: 'TIN Registration',
    description: 'Tax Identification Number registration.',
    icon: Receipt,
    route: '/tin-registration',
    tint: 'bronze',
    implemented: false,
  },
];

export const TINT_CLASSES: Record<ServiceTint, { bg: string; text: string }> = {
  gold: { bg: 'bg-gold-500/12', text: 'text-gold-600' },
  bronze: { bg: 'bg-bronze-500/12', text: 'text-bronze-700' },
  ember: { bg: 'bg-ember-500/12', text: 'text-ember-600' },
  success: { bg: 'bg-success-500/12', text: 'text-success-600' },
  ink: { bg: 'bg-ink/8', text: 'text-ink' },
};
