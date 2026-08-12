import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Wifi,
  Tv,
  Zap,
  ShieldCheck,
  GraduationCap,
  BookOpenCheck,
  BookOpen,
  Wallet,
  MousePointerClick,
  PackageCheck,
  Download,
  Lock,
  Landmark,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';
import PublicNav from '../components/PublicNav';
import RatesTicker from '../components/RatesTicker';
import Footer from '../components/Footer';
import { api } from '../lib/api';
import { CONTACT, whatsappLink } from '../lib/contact';

const SERVICES = [
  { icon: Smartphone, name: 'Airtime', desc: 'All networks, instant delivery' },
  { icon: Wifi, name: 'Data Bundles', desc: 'SME, gifting & corporate plans' },
  { icon: Tv, name: 'Cable TV', desc: 'DStv, GOtv, Startimes' },
  { icon: Zap, name: 'Electricity', desc: 'Prepaid & postpaid tokens' },
  { icon: ShieldCheck, name: 'Verification', desc: 'NIN, BVN & ID services' },
  { icon: GraduationCap, name: 'Result Checkers', desc: 'WAEC, NECO & NABTEB pins' },
];

const STEPS = [
  {
    icon: Wallet,
    title: 'Fund your wallet',
    desc: 'Transfer once to your dedicated account number — funds reflect in seconds.',
  },
  {
    icon: MousePointerClick,
    title: 'Pick a service',
    desc: 'Airtime, data, cable, electricity or verification — choose and confirm.',
  },
  {
    icon: PackageCheck,
    title: 'Delivered instantly',
    desc: 'No waiting, no manual approval. Your top-up lands immediately.',
  },
];

const TRUST_POINTS = [
  {
    icon: Lock,
    title: 'Encrypted at rest',
    desc: 'Sensitive identity data (NIN/BVN) is encrypted in our database, not stored in plain text.',
  },
  {
    icon: Landmark,
    title: 'Bank-backed funding',
    desc: 'Wallet funding runs through a licensed payment processor, straight to your dedicated account number.',
  },
  {
    icon: MessageCircle,
    title: 'Real support, on WhatsApp',
    desc: `Reach an actual person any time at ${CONTACT.whatsapp} — no ticket queues.`,
  },
];

const FAQS = [
  {
    q: 'How do I fund my wallet?',
    a: 'After you register, you get a dedicated account number. Transfer any amount to it from any Nigerian bank and your wallet updates automatically — usually within seconds.',
  },
  {
    q: 'How fast is delivery?',
    a: "Airtime, data, and result checker pins are delivered instantly after payment — there's no manual approval step on our side.",
  },
  {
    q: 'Is my money safe?',
    a: 'Your wallet is funded through a licensed payment processor via a dedicated bank account in your name, and your identity data is encrypted in our database.',
  },
  {
    q: 'What if a transaction fails?',
    a: "If a purchase can't be completed, your wallet is automatically refunded — you can see this reflected instantly in your transaction history.",
  },
  {
    q: "I'm stuck — how do I reach support?",
    a: `Message us directly on WhatsApp at ${CONTACT.whatsapp}, or email ${CONTACT.emailDisplay}. A real person responds.`,
  },
];

type ResultPrice = { service: string; label: string; unit_price: number };

const RESULT_ICON: Record<string, typeof GraduationCap> = {
  WAEC_PIN: GraduationCap,
  NECO_PIN: BookOpenCheck,
  NABTEB_PIN: BookOpen,
};

export default function LandingPage() {
  const [resultPrices, setResultPrices] = useState<ResultPrice[] | null>(null);

  useEffect(() => {
    api
      .get<{ status: boolean; data: ResultPrice[] }>('/public/result-prices', false)
      .then((res) => setResultPrices(res.data ?? []))
      .catch(() => setResultPrices([]));
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="bg-ink">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-16 pb-14 md:grid-cols-[1.1fr_0.9fr] md:pt-24 md:pb-20">
          <div>
            <span className="inline-block rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-gold-400">
              Wallet-based · Instant · Nigeria-wide
            </span>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] font-bold text-cream sm:text-5xl lg:text-6xl">
              Top up like you're
              <br />
              trading <span className="text-gold-500">gold.</span>
            </h1>
            <p className="mt-5 max-w-md font-body text-base leading-relaxed text-cream/60 sm:text-lg">
              One wallet. Every network, every bill. Fund once, spend on airtime, data,
              cable and electricity in seconds — at rates that don't move against you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="rounded-lg bg-gold-500 px-6 py-3.5 font-display text-sm font-semibold text-ink transition hover:bg-gold-400"
              >
                Open your wallet — it's free
              </Link>
              <a
                href="#download"
                className="flex items-center gap-2 font-body text-sm font-medium text-cream/80 transition hover:text-cream"
              >
                <Download size={16} /> Get the mobile app
              </a>
            </div>
          </div>

          {/* Live rates board panel */}
          <div className="rounded-2xl border border-ink-line bg-ink-soft p-5">
            <div className="flex items-center justify-between border-b border-ink-line pb-3">
              <span className="font-display text-sm font-semibold text-cream">Live Rates Board</span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-success-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" /> LIVE
              </span>
            </div>
            <div className="mt-3 divide-y divide-ink-line">
              {[
                ['1GB · MTN SME', '₦345'],
                ['2GB · Glo Gifting', '₦480'],
                ['5GB · Airtel Corporate', '₦1,900'],
                ['Airtime · All networks', 'up to 3% off'],
                ['DStv Compact', '₦19,000'],
              ].map(([label, price]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-sm text-cream/70">{label}</span>
                  <span className="font-mono text-sm font-semibold text-gold-400">{price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RatesTicker />

      {/* ── Services ── */}
      <section id="services" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-lg">
          <span className="font-mono text-xs uppercase tracking-widest text-bronze-500">
            The board
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            Everything you top up, in one place
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              key={s.name}
              className="group rounded-xl border border-parchment-line bg-parchment p-6 transition hover:border-gold-500/60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-gold-500">
                <s.icon size={20} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{s.name}</h3>
              <p className="mt-1 font-body text-sm text-ink-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Result Checker Pricing ── */}
      <section id="result-checkers" className="bg-parchment">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-bronze-500">
              Result checkers
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
              WAEC, NECO & NABTEB pins, at real prices
            </h2>
            <p className="mt-3 font-body text-sm text-ink-600">
              These are our live prices, pulled straight from the same system that processes
              every order — not a rate card that goes stale.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {resultPrices === null &&
              [0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-xl border border-parchment-line bg-cream"
                />
              ))}

            {resultPrices?.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-parchment-line px-6 py-10 text-center font-body text-sm text-ink-600">
                Result checker pricing is being updated — check back shortly, or see current
                prices in the app after you register.
              </div>
            )}

            {resultPrices?.map((p) => {
              const Icon = RESULT_ICON[p.service] ?? GraduationCap;
              return (
                <div
                  key={p.service}
                  className="flex flex-col rounded-xl border border-parchment-line bg-cream p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-gold-500">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-ink">
                    {p.label}
                  </h3>
                  <p className="mt-1 font-body text-xs text-ink-600">
                    Delivered instantly to your wallet's transaction history.
                  </p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-ink">
                      ₦{p.unit_price.toLocaleString()}
                    </span>
                    <span className="font-body text-xs text-ink-600">/ pin</span>
                  </div>
                  <Link
                    to="/register"
                    className="mt-5 rounded-lg bg-ink px-4 py-2.5 text-center font-body text-sm font-semibold text-cream transition hover:bg-ink-soft"
                  >
                    Get a {p.label.split(' ')[0]} pin
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-lg">
          <span className="font-mono text-xs uppercase tracking-widest text-bronze-500">
            The process
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            Three steps, every time
          </h2>
        </div>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative">
              <span className="font-mono text-5xl font-bold text-gold-500/20">0{i + 1}</span>
              <div className="-mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-gold-500">
                <step.icon size={18} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 font-body text-sm leading-relaxed text-ink-600">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-gold-500">
              Built to be trusted
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold text-cream sm:text-4xl">
              Not just fast — accountable
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TRUST_POINTS.map((t) => (
              <div key={t.title} className="rounded-xl border border-ink-line bg-ink-soft p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 text-gold-500">
                  <t.icon size={18} />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-cream">
                  {t.title}
                </h3>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-cream/60">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-parchment">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <div className="text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-bronze-500">
              Questions
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
              Before you get started
            </h2>
          </div>
          <div className="mt-10 divide-y divide-parchment-line rounded-xl border border-parchment-line bg-cream">
            {FAQS.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section id="download" className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-gold-500">
            Take it with you
          </span>
          <h2 className="max-w-xl font-display text-3xl font-bold text-cream sm:text-4xl">
            The full experience lives in the app
          </h2>
          <p className="max-w-md font-body text-sm text-cream/60">
            Biometric login, saved beneficiaries, instant push alerts on every transaction.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="rounded-lg bg-gold-500 px-6 py-3.5 font-display text-sm font-semibold text-ink transition hover:bg-gold-400"
            >
              Continue on the web instead
            </Link>
            <span className="flex items-center gap-2 rounded-lg border border-ink-line px-6 py-3.5 font-body text-sm text-cream/50">
              <Download size={16} /> Android app coming to Play Store
            </span>
          </div>
          <a
            href={whatsappLink("Hello MAJOR DATA-LINK, I'd like to know more before signing up")}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 font-body text-xs text-cream/40 transition hover:text-cream/70"
          >
            <MessageCircle size={13} /> Or ask us a question first, on WhatsApp
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-body text-sm font-semibold text-ink">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-600 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <p className="pb-4 font-body text-sm leading-relaxed text-ink-600">{a}</p>}
    </div>
  );
}
