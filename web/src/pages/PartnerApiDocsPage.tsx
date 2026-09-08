import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  ChevronDown,
  Copy,
  Fingerprint,
  Hourglass,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Signal,
  Smartphone,
  Wallet as WalletIcon,
  Webhook
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '') + '/api/v1';

const SECTIONS = [
  { id: 'auth', key: 'auth' },
  { id: 'wallet', key: 'wallet' },
  { id: 'data-airtime', key: 'dataAirtime' },
  { id: 'nin', key: 'nin' },
  { id: 'bvn', key: 'bvn' },
  { id: 'async', key: 'async' },
  { id: 'transactions', key: 'transactions' },
  { id: 'webhooks', key: 'webhooks' },
  { id: 'errors', key: 'errors' }
];

export default function PartnerApiDocsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState('auth');

  function scrollTo(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div>
            <p className="font-bold">{t('partnerPortal.docs.pageTitle')}</p>
            <p className="text-xs text-slate-500">{t('partnerPortal.docs.pageSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/partner-dashboard"
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
            >
              <LayoutDashboard size={16} />
              {t('partnerPortal.header.dashboard')}
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-3 text-sm">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 font-semibold transition ${
                active === s.id ? 'bg-brand-700 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t(`partnerPortal.docs.sections.${s.key}`)}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        <Card>
          <h1 className="text-2xl font-bold">{t('partnerPortal.docs.pageTitle')}</h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t('partnerPortal.docs.intro')}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge>Base URL: {API_BASE}</Badge>
            <Badge>JSON over HTTPS</Badge>
            <Badge tone="green">60 req/min · 30 req/min on purchases</Badge>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            {t('partnerPortal.docs.keyNotice')}{' '}
            <Link to="/partner-dashboard" className="font-semibold text-brand-700 underline">
              {t('partnerPortal.docs.keyNoticeLink')}
            </Link>{' '}
            {t('partnerPortal.docs.keyNoticeSuffix')}
          </p>
        </Card>

        <Section id="auth" icon={KeyRound} title={t('partnerPortal.docs.sections.auth')}>
          <p className="text-slate-600">
            <Trans i18nKey="partnerPortal.docs.auth.body" components={{ code: <code /> }} />
          </p>
          <CodeTabs
            curl={`curl -X POST ${API_BASE}/data/purchase \\\n  -H "X-API-Key: mdl_live_xxxxxxxxxxxxxxxxxxxx" \\\n  -H "Idempotency-Key: order-8821" \\\n  -H "Content-Type: application/json" \\\n  -d '{"network":"MTN","plan_id":"mtn-1gb-30d","phone":"08012345678"}'`}
            javascript={`await fetch("${API_BASE}/data/purchase", {\n  method: "POST",\n  headers: {\n    "X-API-Key": "mdl_live_xxxxxxxxxxxxxxxxxxxx",\n    "Idempotency-Key": "order-8821",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({ network: "MTN", plan_id: "mtn-1gb-30d", phone: "08012345678" })\n});`}
            php={`$ch = curl_init("${API_BASE}/data/purchase");\ncurl_setopt_array($ch, [\n  CURLOPT_POST => true,\n  CURLOPT_HTTPHEADER => [\n    "X-API-Key: mdl_live_xxxxxxxxxxxxxxxxxxxx",\n    "Idempotency-Key: order-8821",\n    "Content-Type: application/json"\n  ],\n  CURLOPT_POSTFIELDS => json_encode(["network" => "MTN", "plan_id" => "mtn-1gb-30d", "phone" => "08012345678"]),\n  CURLOPT_RETURNTRANSFER => true\n]);\n$response = curl_exec($ch);`}
          />
          <p className="mt-3 text-xs text-slate-500">
            <Trans i18nKey="partnerPortal.docs.auth.idempotencyNote" components={{ code: <code /> }} />
          </p>
        </Section>

        <Section id="wallet" icon={WalletIcon} title={t('partnerPortal.docs.sections.wallet')}>
          <p className="text-slate-600">{t('partnerPortal.docs.wallet.intro')}</p>
          <EndpointCard method="GET" path="/wallet/balance" title={t('partnerPortal.docs.wallet.balance')} icon={Banknote}>
            <ResponseExample json={`{\n  "status": true,\n  "data": { "balance": 45250, "currency": "NGN" }\n}`} />
          </EndpointCard>
          <EndpointCard method="POST" path="/wallet/funding-account" title={t('partnerPortal.docs.wallet.createAccount')} icon={Landmark}>
            <p className="text-sm text-slate-600">{t('partnerPortal.docs.wallet.createAccountBody')}</p>
            <ResponseExample json={`{\n  "status": true,\n  "data": {\n    "balance": 45250,\n    "virtual_account_number": "9012345678",\n    "virtual_account_bank": "Wema Bank"\n  }\n}`} />
          </EndpointCard>
          <EndpointCard method="POST" path="/wallet/fund/dynamic" title={t('partnerPortal.docs.wallet.dynamic')} icon={ArrowUpRight}>
            <ParamsTable rows={[{ name: 'amount', type: 'number', required: true, desc: 'Amount in Naira to fund' }]} />
            <ResponseExample json={`{\n  "status": true,\n  "data": { "amount": 5000, "reference": "MDL-FUND-8821", "account_number": "9019283746" }\n}`} />
          </EndpointCard>
        </Section>

        <Section id="data-airtime" icon={Signal} title={t('partnerPortal.docs.sections.dataAirtime')}>
          <EndpointCard method="GET" path="/data/plans/:network/categories" title={t('partnerPortal.docs.dataAirtime.categories')} icon={Signal} />
          <EndpointCard method="GET" path="/data/plans/:network" title={t('partnerPortal.docs.dataAirtime.plans')} icon={Signal}>
            <ParamsTable rows={[{ name: 'category', type: 'string', required: false, desc: 'Query param - filter by category (e.g. SME, GIFTING)' }]} />
          </EndpointCard>
          <EndpointCard method="POST" path="/data/purchase" title={t('partnerPortal.docs.dataAirtime.buyData')} icon={Signal} rateNote="30/min">
            <ParamsTable
              rows={[
                { name: 'network', type: 'string', required: true, desc: 'MTN, GLO, AIRTEL, or 9MOBILE' },
                { name: 'plan_id', type: 'string', required: true, desc: 'From the plans list above' },
                { name: 'phone', type: 'string', required: true, desc: 'Recipient phone number' }
              ]}
            />
            <ResponseExample json={`{\n  "status": true,\n  "message": "Transaction processed",\n  "data": { "reference": "MDL-...", "status": "success", "amount": 350, "balance_after": 44900 }\n}`} />
          </EndpointCard>
          <EndpointCard method="POST" path="/airtime/purchase" title={t('partnerPortal.docs.dataAirtime.buyAirtime')} icon={Smartphone} rateNote="30/min">
            <ParamsTable
              rows={[
                { name: 'network', type: 'string', required: true, desc: 'MTN, GLO, AIRTEL, or 9MOBILE' },
                { name: 'phone', type: 'string', required: true, desc: 'Recipient phone number' },
                { name: 'amount', type: 'number', required: true, desc: 'Naira, up to 500,000' }
              ]}
            />
          </EndpointCard>
          <Callout>
            <Trans i18nKey="partnerPortal.docs.dataAirtime.pendingNote" components={{ code: <code /> }} />
          </Callout>
        </Section>

        <Section id="nin" icon={Fingerprint} title={t('partnerPortal.docs.sections.nin')}>
          <p className="text-slate-600">{t('partnerPortal.docs.nin.intro')}</p>
          <TieredEndpointCard
            method="POST"
            path="/verification/nin/by-nin"
            title="NIN Verification by NIN Number"
            tiers={['premium', 'standard', 'regular', 'vnin']}
            rows={[
              { name: 'nin', type: 'string', required: true, desc: '11-digit NIN' },
              { name: 'tier', type: 'string', required: true, desc: 'premium, standard, regular, or vnin' }
            ]}
          />
          <TieredEndpointCard
            method="POST"
            path="/verification/nin/by-phone"
            title="NIN Verification by Phone Number"
            tiers={['premium', 'standard', 'regular']}
            rows={[
              { name: 'phone', type: 'string', required: true, desc: 'Phone number registered to the NIN' },
              { name: 'tier', type: 'string', required: true, desc: 'premium, standard, or regular' }
            ]}
          />
          <EndpointCard method="POST" path="/verification/nin/by-demographic" title="NIN Verification by Demographic Details" icon={Fingerprint}>
            <ParamsTable
              rows={[
                { name: 'firstname', type: 'string', required: true, desc: '' },
                { name: 'lastname', type: 'string', required: true, desc: '' },
                { name: 'dob', type: 'string', required: true, desc: 'YYYY-MM-DD' },
                { name: 'gender', type: 'string', required: false, desc: 'MALE or FEMALE' }
              ]}
            />
          </EndpointCard>
        </Section>

        <Section id="bvn" icon={BadgeCheck} title={t('partnerPortal.docs.sections.bvn')}>
          <TieredEndpointCard
            method="POST"
            path="/verification/bvn/slip"
            title="BVN Verification Slip"
            tiers={['premium', 'standard']}
            rows={[
              { name: 'bvn', type: 'string', required: true, desc: '11-digit BVN' },
              { name: 'tier', type: 'string', required: true, desc: 'premium or standard' }
            ]}
          />
        </Section>

        <Section id="async" icon={Hourglass} title={t('partnerPortal.docs.sections.async')}>
          <p className="text-slate-600">
            <Trans i18nKey="partnerPortal.docs.async.intro" components={{ code: <code />, bold: <strong /> }} />
          </p>
          <Callout>
            {t('partnerPortal.docs.async.pollNote')}{' '}
            <Link to="/partner-dashboard" className="font-semibold underline">
              {t('partnerPortal.docs.async.pollNoteLink')}
            </Link>{' '}
            {t('partnerPortal.docs.async.pollNoteSuffix')}
          </Callout>
          <AsyncServiceCard
            title="NIN Validation"
            desc="Validate a NIN against a specific issue type."
            submitPath="/verification/nin/validation"
            checkPath="/verification/nin/validation/:ticketId"
            rows={[
              { name: 'nin', type: 'string', required: true, desc: '11-digit NIN' },
              { name: 'validation_type', type: 'string', required: false, desc: 'nin_validation, no_record, sim, modification, photo_error, bank_validation, update_records' }
            ]}
          />
          <AsyncServiceCard
            title="NIN Personalization"
            desc="Submit a personalization request by NIMC tracking ID."
            submitPath="/verification/nin/personalization"
            checkPath="/verification/nin/personalization/:ticketId"
            rows={[{ name: 'tracking_id', type: 'string', required: true, desc: 'NIMC tracking ID' }]}
          />
          <AsyncServiceCard
            title="IPE Clearance"
            desc="Submit an IPE clearance request by tracking ID."
            submitPath="/verification/nin/ipe-clearance"
            checkPath="/verification/nin/ipe-clearance/:ticketId"
            rows={[{ name: 'tracking_id', type: 'string', required: true, desc: 'Tracking ID' }]}
          />
        </Section>

        <Section id="transactions" icon={ListChecks} title={t('partnerPortal.docs.sections.transactions')}>
          <EndpointCard method="GET" path="/transactions/:reference" title={t('partnerPortal.docs.transactions.lookup')} icon={ListChecks}>
            <ResponseExample json={`{\n  "status": true,\n  "data": { "reference": "MDL-...", "status": "success", "type": "data_purchase", "amount": 350, "balance_after": 44900 }\n}`} />
          </EndpointCard>
          <EndpointCard method="GET" path="/transactions" title={t('partnerPortal.docs.transactions.list')} icon={ListChecks} />
        </Section>

        <Section id="webhooks" icon={Webhook} title={t('partnerPortal.docs.sections.webhooks')}>
          <p className="text-slate-600">
            {t('partnerPortal.docs.webhooks.intro')}{' '}
            <Link to="/partner-dashboard" className="font-semibold text-brand-700 underline">
              {t('partnerPortal.docs.webhooks.introLink')}
            </Link>{' '}
            {t('partnerPortal.docs.webhooks.introSuffix')}
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">{t('partnerPortal.docs.webhooks.headers')}</p>
            <CodeBlock code={'X-MDL-Event: transaction.updated\nX-MDL-Signature: sha256=<HMAC-SHA256 of the raw body>'} />
          </div>
          <ResponseExample
            title={t('partnerPortal.docs.webhooks.payload')}
            json={`{\n  "event": "transaction.updated",\n  "data": {\n    "reference": "MDL-20260904-ABC123",\n    "status": "success",\n    "type": "data_purchase",\n    "amount": 350,\n    "message": "Transaction processed"\n  }\n}`}
          />
          <Callout>
            <Trans i18nKey="partnerPortal.docs.webhooks.note" components={{ code: <code /> }} />
          </Callout>
        </Section>

        <Section id="errors" icon={AlertTriangle} title={t('partnerPortal.docs.sections.errors')}>
          <p className="text-slate-600">
            <Trans i18nKey="partnerPortal.docs.errors.intro" components={{ code: <code /> }} />
          </p>
          <ResponseExample json={`{\n  "status": false,\n  "message": "Insufficient wallet balance",\n  "code": "INSUFFICIENT_BALANCE"\n}`} />
          <div className="mt-4 space-y-2">
            {[
              { code: 200, tone: 'green', desc: t('partnerPortal.docs.errors.code200') },
              { code: 400, tone: 'red', desc: t('partnerPortal.docs.errors.code400') },
              { code: 401, tone: 'red', desc: t('partnerPortal.docs.errors.code401') },
              { code: 404, tone: 'red', desc: t('partnerPortal.docs.errors.code404') },
              { code: 422, tone: 'amber', desc: t('partnerPortal.docs.errors.code422') },
              { code: 429, tone: 'amber', desc: t('partnerPortal.docs.errors.code429') }
            ].map((row) => (
              <div key={row.code} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <span
                  className={`w-12 rounded-md px-2 py-0.5 text-center text-xs font-bold text-white ${
                    row.tone === 'green' ? 'bg-emerald-500' : row.tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                >
                  {row.code}
                </span>
                <span className="text-sm text-slate-600">{row.desc}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6">{children}</section>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'green' }) {
  return (
    <span
      className={`rounded-full px-3 py-1 font-semibold ${
        tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-brand-700'
      }`}
    >
      {children}
    </span>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children
}: {
  id: string;
  icon: typeof KeyRound;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Icon className="text-brand-700" size={20} />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-relaxed text-teal-900">
      {children}
    </div>
  );
}

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white ${
        method === 'GET' ? 'bg-blue-500' : 'bg-emerald-600'
      }`}
    >
      {method}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md bg-white/10 p-1.5 text-slate-300 hover:bg-white/20"
      title="Copy"
    >
      <Copy size={13} />
      {copied && <span className="ml-1 text-[10px]">Copied</span>}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 pr-10">
      <pre className="text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function CodeTabs({ curl, javascript, php }: { curl: string; javascript: string; php: string }) {
  const [tab, setTab] = useState<'curl' | 'javascript' | 'php'>('curl');
  const code = tab === 'curl' ? curl : tab === 'javascript' ? javascript : php;
  return (
    <div className="mt-3">
      <div className="flex gap-1 text-xs font-semibold">
        {(['curl', 'javascript', 'php'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-1.5 ${tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
          >
            {t === 'curl' ? 'cURL' : t === 'javascript' ? 'JavaScript' : 'PHP'}
          </button>
        ))}
      </div>
      <CodeBlock code={code} />
    </div>
  );
}

function ParamsTable({ rows }: { rows: { name: string; type: string; required: boolean; desc: string }[] }) {
  const { t } = useTranslation();
  return (
    <table className="mt-3 w-full text-left text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="py-2 pr-3 font-semibold">{t('partnerPortal.docs.params.parameter')}</th>
          <th className="py-2 pr-3 font-semibold">{t('partnerPortal.docs.params.type')}</th>
          <th className="py-2 pr-3 font-semibold">{t('partnerPortal.docs.params.required')}</th>
          <th className="py-2 font-semibold">{t('partnerPortal.docs.params.description')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="py-2 pr-3 font-mono">{r.name}</td>
            <td className="py-2 pr-3 text-slate-500">{r.type}</td>
            <td className={`py-2 pr-3 font-semibold ${r.required ? 'text-rose-600' : 'text-slate-400'}`}>
              {r.required ? t('partnerPortal.docs.params.yes') : t('partnerPortal.docs.params.no')}
            </td>
            <td className="py-2 text-slate-600">{r.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResponseExample({ json, title }: { json: string; title?: string }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-slate-500">{title ?? t('partnerPortal.docs.response')}</p>
      <CodeBlock code={json} />
    </div>
  );
}

function EndpointCard({
  method,
  path,
  title,
  icon: Icon,
  rateNote,
  children
}: {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  icon: typeof KeyRound;
  rateNote?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-brand-700" />
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <MethodBadge method={method} /> {path}
              {rateNote && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">{rateNote}</span>}
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}

function TieredEndpointCard({
  method,
  path,
  title,
  tiers,
  rows
}: {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  tiers: string[];
  rows: { name: string; type: string; required: boolean; desc: string }[];
}) {
  const [tier, setTier] = useState(tiers[0]);
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tiers.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
              tier === t ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 font-mono text-xs text-slate-500">
        <MethodBadge method={method} /> {path}
      </p>
      <ParamsTable rows={rows} />
      <ResponseExample
        json={`{\n  "status": true,\n  "message": "PDF generated successfully",\n  "data": { "reference": "MDL-...", "balance_after": 44900, "pdf_base64": "..." }\n}`}
      />
    </div>
  );
}

function AsyncServiceCard({
  title,
  desc,
  submitPath,
  checkPath,
  rows
}: {
  title: string;
  desc: string;
  submitPath: string;
  checkPath: string;
  rows: { name: string; type: string; required: boolean; desc: string }[];
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
      <div className="mt-3 space-y-2">
        <EndpointCard method="POST" path={submitPath} title={t('partnerPortal.docs.async.submitRequest')} icon={Hourglass}>
          <ParamsTable rows={rows} />
          <ResponseExample json={`{\n  "status": true,\n  "data": { "reference": "MDL-...", "ticket_id": "TCK-8821", "status": "pending" }\n}`} />
        </EndpointCard>
        <EndpointCard method="GET" path={checkPath} title={t('partnerPortal.docs.async.checkStatus')} icon={ListChecks}>
          <ResponseExample json={`{\n  "status": true,\n  "data": { "ticket_id": "TCK-8821", "status": "success", "response": { } }\n}`} />
        </EndpointCard>
      </div>
    </div>
  );
}
