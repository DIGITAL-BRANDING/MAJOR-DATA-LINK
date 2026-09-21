import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, H2, H4, Icon, Text } from '@adminjs/design-system';

const ADMIN_ROOT_PATH = '/admin';
type PendingSummary = { total_pending: number; total_new_last_24h: number; by_type: Array<{ type: string; label: string; href: string; pending: number }> };

function PendingRequestsPopup() {
  const [summary, setSummary] = useState<PendingSummary | null>(null); const [dismissed, setDismissed] = useState(false);
  const previousPending = useRef<number | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => fetch(`${ADMIN_ROOT_PATH}/pending-summary`, { credentials: 'include' }).then((r) => r.ok ? r.json() : Promise.reject()).then((body) => { if (active) setSummary(body.data); }).catch(() => {});
    void load();
    const interval = window.setInterval(load, 45_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    if (summary && previousPending.current !== null && summary.total_pending > previousPending.current) setDismissed(false);
    if (summary) previousPending.current = summary.total_pending;
  }, [summary]);
  if (dismissed || !summary || summary.total_pending === 0) return null;
  return <Box style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000 }} display="flex" alignItems="center" justifyContent="center" onClick={() => setDismissed(true)}><Box variant="white" boxShadow="card" p="xl" style={{ width: 'min(480px,92vw)', borderRadius: 14 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}><H4 mb="default">Requests waiting on you</H4><Text mb="lg">{summary.total_pending} unresolved request{summary.total_pending === 1 ? '' : 's'}{summary.total_new_last_24h ? ` • ${summary.total_new_last_24h} new today` : ''}</Text>{summary.by_type.filter((row) => row.pending).map((row) => <a key={row.type} href={row.href} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid #eee', textDecoration: 'none' }}><Text fontWeight="bold">{row.label}: {row.pending} pending →</Text></a>)}<Button mt="lg" onClick={() => setDismissed(true)} style={{ width: '100%' }}>Got it</Button></Box></Box>;
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

// Keep the dashboard intentionally short. Every specialist tool still lives
// in the AdminJS sidebar; these cards are the everyday work queues and the
// few control areas an admin needs most often.
const quickLinks: QuickLink[] = [
  { label: 'Customers', description: 'Users, KYC status & profiles', resourceId: 'User', icon: 'Users' },
  { label: 'Ledger', description: 'Transactions, reversals & history', resourceId: 'Transaction', icon: 'List' },
  { label: 'All Manual Requests', description: 'One queue for every customer and Partner API request awaiting processing', href: `${ADMIN_ROOT_PATH}/manual-requests`, icon: 'List' },
  { label: 'NIN Services', description: 'NIN validation, personalization, slips and modifications awaiting manual processing', href: `${ADMIN_ROOT_PATH}/manual-requests?group=NIN`, icon: 'Fingerprint' },
  { label: 'BVN Services', description: 'BVN slips, retrieval, modification, CRM and licence requests', href: `${ADMIN_ROOT_PATH}/manual-requests?group=BVN`, icon: 'CreditCard' },
  { label: 'CAC Services', description: 'All CAC registration and verification requests in one queue', href: `${ADMIN_ROOT_PATH}/manual-requests?group=CAC`, icon: 'Briefcase' },
  { label: 'JAMB Services', description: 'All paid JAMB document and admission requests in one queue', href: `${ADMIN_ROOT_PATH}/manual-requests?group=JAMB`, icon: 'GraduationCap' },
  { label: 'TIN & Other Services', description: 'TIN-ready queue plus Birth Attestation, Newspaper and new manual services', href: `${ADMIN_ROOT_PATH}/manual-requests?group=TIN_OTHER`, icon: 'FileText' },
  { label: 'User Deliveries', description: 'Upload completed CAC, JAMB or other service files to a customer', href: `${ADMIN_ROOT_PATH}/user-deliveries`, icon: 'Upload' },
  { label: 'Service Pricing', description: 'Prices and provider routing for all services', resourceId: 'ServicePricing', icon: 'Tag' },
  { label: 'Company Wallet', description: 'Revenue, provider cost & net profit by service', href: `${ADMIN_ROOT_PATH}/company-wallet`, icon: 'TrendingUp' },
  { label: 'Notifications', description: 'Broadcast messages to users', resourceId: 'NotificationBroadcast', icon: 'Bell' },
  { label: 'Partners', description: 'Review API partner accounts and status', resourceId: 'Partner', icon: 'Briefcase' },
  { label: 'Admin Access', description: 'Admin accounts, roles and audit history', resourceId: 'AdminUser', icon: 'Shield' }
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

