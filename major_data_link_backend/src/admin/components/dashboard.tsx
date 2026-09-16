import React, { useEffect, useState } from 'react';
import { Box, Button, H2, H4, Icon, Text } from '@adminjs/design-system';

const ADMIN_ROOT_PATH = '/admin';
type PendingSummary = { total_pending: number; total_new_last_24h: number; by_type: Array<{ type: string; label: string; pending: number }> };

function PendingRequestsPopup() {
  const [summary, setSummary] = useState<PendingSummary | null>(null); const [dismissed, setDismissed] = useState(false);
  useEffect(() => { fetch(`${ADMIN_ROOT_PATH}/pending-summary`, { credentials: 'include' }).then((r) => r.ok ? r.json() : Promise.reject()).then((body) => setSummary(body.data)).catch(() => {}); }, []);
  if (dismissed || !summary || summary.total_pending === 0) return null;
  return <Box style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000 }} display="flex" alignItems="center" justifyContent="center" onClick={() => setDismissed(true)}><Box variant="white" boxShadow="card" p="xl" style={{ width: 'min(480px,92vw)', borderRadius: 14 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}><H4 mb="default">Requests waiting on you</H4><Text mb="lg">{summary.total_pending} unresolved request{summary.total_pending === 1 ? '' : 's'}{summary.total_new_last_24h ? ` • ${summary.total_new_last_24h} new today` : ''}</Text>{summary.by_type.filter((row) => row.pending).map((row) => <a key={row.type} href={`${ADMIN_ROOT_PATH}/resources/Transaction?filters.type=${row.type}&filters.status=PENDING`} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid #eee', textDecoration: 'none' }}><Text fontWeight="bold">{row.label}: {row.pending} pending →</Text></a>)}<Button mt="lg" onClick={() => setDismissed(true)} style={{ width: '100%' }}>Got it</Button></Box></Box>;
}

type QuickLink = {
  label: string;
  description: string;
  /** AdminJS resource-backed page - mutually exclusive with `href`. */
  resourceId?: string;
  /** Plain server-rendered page (Bulk Pricing, Company Wallet, etc) - mutually exclusive with `resourceId`. */
  href?: string;
  icon: string;
};

// One card per resource an admin actually works with day-to-day. Kept in the
// same grouping order as the sidebar navigation (Customers, Ledger, Products,
// Wallet, Communication, Access Control) so the dashboard reads as a map of
// the sidebar rather than a separate, unrelated list.
const quickLinks: QuickLink[] = [
  { label: 'Customers', description: 'Users, KYC status & profiles', resourceId: 'User', icon: 'Users' },
  { label: 'Ledger', description: 'Transactions, reversals & history', resourceId: 'Transaction', icon: 'List' },
  { label: 'CAC Registration Requests', description: 'CAC registration and verification requests awaiting processing', resourceId: 'SupportTicket', icon: 'Briefcase' },
  { label: 'JAMB Service Requests', description: 'Paid JAMB documents and admission requests awaiting processing', href: `${ADMIN_ROOT_PATH}/resources/Transaction?filters.type=JAMB_SERVICE_REQUEST`, icon: 'GraduationCap' },
  { label: 'BVN Licence Requests', description: 'BVN licence onboarding requests awaiting agent processing', href: `${ADMIN_ROOT_PATH}/resources/Transaction?filters.type=BVN_LICENSE_ONBOARDING`, icon: 'CreditCard' },
  { label: 'NIN Modification Requests', description: 'Manual NIN correction requests awaiting processing', href: `${ADMIN_ROOT_PATH}/resources/Transaction?filters.type=NIN_MODIFICATION`, icon: 'Edit' },
  {
    label: 'User Wallet Activity',
    description: 'Look up any customer: funding, spend & recent transactions',
    href: `${ADMIN_ROOT_PATH}/user-wallet`,
    icon: 'Search'
  },
  {
    label: 'Customer Activity',
    description: 'Top customers, what they bought, and reward candidates',
    href: `${ADMIN_ROOT_PATH}/customer-activity`,
    icon: 'Award'
  },
  {
    label: 'Login Activity',
    description: 'Latest customer App/Web logins and partner portal access',
    href: `${ADMIN_ROOT_PATH}/login-activity`,
    icon: 'LogIn'
  },
  {
    label: 'User Deliveries',
    description: 'Upload completed CAC, JAMB or other service files to a customer',
    href: `${ADMIN_ROOT_PATH}/user-deliveries`,
    icon: 'Upload'
  },
  {
    label: 'Service Requests',
    description: 'Open and process CAC, JAMB and customer support requests',
    resourceId: 'SupportTicket',
    icon: 'MessageCircle'
  },
  {
    label: 'Request Replies',
    description: 'Send updates to customers while a request is being processed',
    resourceId: 'SupportTicketMessage',
    icon: 'Send'
  },
  {
    label: 'Company Wallet',
    description: 'Revenue, provider cost & net profit by service',
    href: `${ADMIN_ROOT_PATH}/company-wallet`,
    icon: 'TrendingUp'
  },
  {
    label: 'Provider Ledger',
    description: 'Our balance at Alrahuz/Techhub, settlements & adjustments',
    href: `${ADMIN_ROOT_PATH}/provider-ledger`,
    icon: 'Repeat'
  },
  {
    label: 'Provider Reconciliation',
    description: 'Transactions stuck "processing" at any provider - confirm success/failure by hand',
    href: `${ADMIN_ROOT_PATH}/provider-reconciliation`,
    icon: 'AlertTriangle'
  },
  {
    label: 'Data Plan Pricing',
    description: 'Set prices for data plans',
    resourceId: 'DataPlanPricing',
    icon: 'ShoppingCart'
  },
  {
    label: 'Bulk Pricing',
    description: 'Reprice every data plan / service in one click',
    href: `${ADMIN_ROOT_PATH}/bulk-pricing`,
    icon: 'Sliders'
  },
  {
    label: 'Service Pricing',
    description: 'NIN/BVN provider, prices & result-pin prices',
    resourceId: 'ServicePricing',
    icon: 'Tag'
  },
  {
    label: 'Partner Pricing',
    description: 'Set the separate API-partner price for each service',
    resourceId: 'ServicePricing',
    icon: 'DollarSign'
  },
  {
    label: 'NIN/BVN Provider',
    description: 'Switch NIN and BVN services between Techhub and FranceVerified',
    href: `${ADMIN_ROOT_PATH}/resources/ServicePricing`,
    icon: 'Repeat'
  },
  { label: 'Coupons', description: 'Discount codes & promotions', resourceId: 'Coupon', icon: 'CreditCard' },
  {
    label: 'Provider Balance',
    description: 'Alrahuz, BilalSadaSub & Techhub provider wallet status',
    resourceId: 'ProviderBalanceStatus',
    icon: 'AlertTriangle'
  },
  {
    label: 'Referral Settings',
    description: 'Referral reward configuration',
    resourceId: 'ReferralSettings',
    icon: 'Percent'
  },
  {
    label: 'Notifications',
    description: 'Broadcast messages to users',
    resourceId: 'NotificationBroadcast',
    icon: 'Bell'
  },
  {
    label: 'App Base URL & Updates',
    description: 'Change the live app API URL, version gate and update message',
    href: `${ADMIN_ROOT_PATH}/resources/AppConfig/records/default/edit`,
    icon: 'Settings'
  },
  {
    label: 'Partner Lookup',
    description: 'Look up any API partner: wallet balance, total API calls & manual funding',
    href: `${ADMIN_ROOT_PATH}/partner-lookup`,
    icon: 'Search'
  },
  { label: 'Partners', description: 'Review API partner accounts and status', resourceId: 'Partner', icon: 'Briefcase' },
  { label: 'Admin Users', description: 'Admin accounts & roles', resourceId: 'AdminUser', icon: 'Shield' },
  { label: 'Audit Log', description: 'Admin activity history', resourceId: 'AdminAuditLog', icon: 'FileText' }
];

const Dashboard: React.FC = () => (
  <Box>
    <PendingRequestsPopup />
    <Box
      position="relative"
      overflow="hidden"
      py="xxl"
      px={['default', 'lg', 'xxl']}
      style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1452a0 100%)' }}
    >
      <Box display="flex" alignItems="center" flexDirection={['column', 'row']}>
        <Box mr={['0', 'xl']} mb={['lg', '0']}>
          <img
            src="/branding/logo.png"
            alt="K-Tech Solutions"
            style={{ width: 96, height: 96, borderRadius: 20, display: 'block' }}
          />
        </Box>
        <Box>
          <H2 color="white" fontWeight="bold" style={{ color: '#ffffff' }}>
            Welcome to K-Tech Solutions Admin
          </H2>
          <Text color="white" style={{ opacity: 0.9, color: '#ffffff' }}>
            Manage customers, requests, deliveries, transactions and pricing from one place.
          </Text>
        </Box>
      </Box>
    </Box>

    <Box px={['default', 'lg', 'xxl']} py="xl">
      <H4 mb="lg">Quick links</H4>
      <Box display="flex" flexWrap="wrap" style={{ gap: 20 }}>
        {quickLinks.map((link) => (
          <a
            key={link.resourceId ?? link.href}
            href={link.href ?? `${ADMIN_ROOT_PATH}/resources/${link.resourceId}`}
            style={{ textDecoration: 'none', display: 'block', width: 280, flexGrow: 1, maxWidth: 340 }}
          >
            <Box variant="white" boxShadow="card" p="lg" style={{ cursor: 'pointer', height: '100%', background: '#0b2f73', borderRadius: 12 }}>
              <Box display="flex" alignItems="center" mb="default">
                <Icon
                  icon={link.icon}
                  color="#ffffff"
                  bg="rgba(96, 165, 250, 0.25)"
                  rounded
                  size={22}
                  p="default"
                  mr="default"
                />
                <Text fontWeight="bold" color="#ffffff">
                  {link.label}
                </Text>
              </Box>
              <Text fontSize="sm" color="#dbeafe">
                {link.description}
              </Text>
            </Box>
          </a>
        ))}
      </Box>
    </Box>
  </Box>
);

export default Dashboard;

