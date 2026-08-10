import { Link } from 'react-router-dom';
import {
  Smartphone,
  Wifi,
  Tv,
  Zap,
  ShieldCheck,
  GraduationCap,
  Wallet,
  MousePointerClick,
  PackageCheck,
  Download,
} from 'lucide-react';
import PublicNav from '../components/PublicNav';
import RatesTicker from '../components/RatesTicker';
import Footer from '../components/Footer';

const SERVICES = [
  { icon: Smartphone, name: 'Airtime', desc: 'All networks, instant delivery' },
  { icon: Wifi, name: 'Data Bundles', desc: 'SME, gifting & corporate plans' },
  { icon: Tv, name: 'Cable TV', desc: 'DStv, GOtv, Startimes' },
  { icon: Zap, name: 'Electricity', desc: 'Prepaid & postpaid tokens' },
  { icon: ShieldCheck, name: 'Verification', desc: 'NIN, BVN & ID services' },
  { icon: GraduationCap, name: 'Result Checkers', desc: 'WAEC, NECO & JAMB pins' },
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

export default function LandingPage() {
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

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-parchment">
        <div className="mx-auto max-w-6xl px-5 py-20">
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
                <span className="font-mono text-5xl font-bold text-gold-500/20">
                  0{i + 1}
                </span>
                <div className="-mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-gold-500">
                  <step.icon size={18} />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-ink-600">
                  {step.desc}
                </p>
              </div>
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
        </div>
      </section>

      <Footer />
    </div>
  );
}
