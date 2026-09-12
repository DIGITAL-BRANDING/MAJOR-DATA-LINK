import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { CONTACT, whatsappLink, ANDROID_APK_URL } from '../lib/contact';

type PriceRow = { service: string; label: string; unit_price: number };

const TXT = {
  HA: {
    navApi: 'API Portal',
    navResults: 'Sakamako (Results)',
    navAbout: 'Game da Mu',
    navHow: 'Yadda Yake Aiki',
    navApp: 'Sauke App',
    navSignin: 'Shiga (Signin)',
    navSignup: 'Rijista',
    navDashboard: 'Dashboard',
    heroTitle: 'Barka da Zuwa MAJOR DATA-LINK',
    heroDesc:
      "Muna samar da ingantattun ayyukan fasahar zamani cikin sauki da hanzari — Data, Airtime, BVN/NIN, da Sakamakon Jarrabawa. Tuntube mu domin samun cikakken taimako akan duk wani sabis na online.",
    heroWhatsapp: 'Tuntube Mu A WhatsApp',
    heroGetStarted: 'Fara Yanzu',
    servicesTitle: 'Ayyukan Mu (Our Services)',
    servicesSubtitle: 'Zabi sabis din da kake bukata, ka fara amfani da shi yanzu — kai tsaye daga account dinka.',
    waTooltip: 'Yi Magana A WhatsApp',
    aboutTitle: 'Game da Mu (About Us)',
    aboutSubtitle: 'MAJOR DATA-LINK wani samfurin Kindness Digital Branding and IT Solutions ne, wanda ake gudanarwa domin sauki da amincin ayyukan ka na yau da kullum.',
    about: [
      { icon: 'fa-lock', title: 'Amintacce', desc: "Muna adana bayanan NIN/BVN dinka a boye, ba tare da bayyana su ba." },
      { icon: 'fa-bolt', title: 'Sauri', desc: "Ana kammala mu'amaloli nan take, babu jira ko izinin hannu." },
      { icon: 'fa-headset', title: 'Tallafi na Gaske', desc: 'Ka samu tallafi kai tsaye a WhatsApp daga mutum, ba tashar sako-sako ba.' },
      { icon: 'fa-university', title: 'Biyan Kudi Amintacce', desc: 'Ana cika walat dinka ta hanyar kamfanin biyan kudi mai lasisi.' },
    ],
    howTitle: 'Yadda Yake Aiki',
    howSubtitle: 'Matakai uku kawai za ka bi, kowane lokaci.',
    how: [
      { title: 'Cika Asusunka', desc: 'Aika kudi zuwa account number dinka na musamman — walat dinka zai cika cikin dakiku.' },
      { title: 'Zabi Sabis', desc: 'Data, Airtime, BVN/NIN, ko Sakamakon Jarrabawa — zaba ka tabbatar.' },
      { title: 'A Bashi Nan Take', desc: 'Babu jira, babu izinin hannu — sabis dinka zai isar nan take.' },
    ],
    appTitle: 'Sauke App Din Mu',
    appDesc: "Samu cikakken kwarewa a app dinmu — shiga da yatsa, ajiye masu karban kudi, da sanarwa nan take akan kowace mu'amala.",
    appBtnDownload: 'Sauke don Android',
    appBtnWeb: 'Ci Gaba Akan Yanar Gizo',
    appNote: "Ba a kan Play Store ba tukuna — wannan yana shigar da app dinka kai tsaye. Android zai tambaye ka izini karo na farko, wannan al'ada ce, ba matsala ba.",
    footerTagline: 'Cika walat dinka sau daya, sayi Data, Airtime, BVN/NIN da Sakamakon Jarrabawa cikin dakiku — babu jira, babu latsi.',
    footerCompanyHeading: 'Kamfani',
    footerServices: 'Ayyukanmu',
    footerHow: 'Yadda Yake Aiki',
    footerPrivacy: 'Manufar Sirri',
    footerTerms: "Sharuɗɗa da Ka'idoji",
    footerDevHeading: 'Masu Haɓakawa',
    footerPortal: 'API Portal',
    footerDocs: 'Takardun API',
    footerContactHeading: 'Tuntube Mu',
    footerChannel: 'Tashar WhatsApp',
    footerRights: 'Duk Haƙƙoƙi An Kiyaye',
    footerCompanyName: 'Kindness Digital Branding and IT Solutions',
    servicePriceLabel: 'Farashi daga',
    cards: {
      vtu: { title: 'VTU SERVICES', item1: 'DATA & AIRTIME', btnData: 'Sayi Data', btnAirtime: 'Sayi Airtime' },
      bvn: {
        title: 'BVN SERVICES',
        items: ['TABBATAR DA BVN', 'GYARA BVN', 'BVN CENTRAL RISK MANAGEMENT', 'BVN LICENCE ONBOARDING CREATION'],
        btn: 'Fara BVN',
      },
      nin: {
        title: 'NIN SERVICES',
        items: ['TABBATAR DA NIN', 'NEMAN NIN TA WAYA', 'GYARA / VALIDATION NA NIN'],
        btn: 'Fara NIN',
      },
      result: {
        title: 'DUBA RESULT',
        items: ['WAEC RESULT CHECKING', 'NECO RESULT CHECKING', 'NABTEB RESULT CHECKING'],
        btn: 'Duba Sakamako',
      },
      token: {
        title: 'SIYAN RESULT TOKEN',
        items: ['NECO TOKEN', 'WAEC TOKEN', 'NABTEB TOKEN'],
        btn: 'Sayi Token',
      },
      cac: { title: 'CAC SERVICES', items: ['CAC REGISTRATIONS', 'CAC VERIFICATION'], btn: 'Fara CAC' },
      jamb: {
        title: 'JAMB SERVICES',
        items: ['CBT PRACTICE SOFTWARE', 'JAMB ORIGINAL RESULT', 'JAMB ADMISSION LETTER', 'JAMB O-LEVEL UPLOAD'],
        btn: 'Fara JAMB',
      },
    },
  },
  EN: {
    navApi: 'API Portal',
    navResults: 'Results',
    navAbout: 'About Us',
    navHow: 'How it Works',
    navApp: 'Download App',
    navSignin: 'Sign in',
    navSignup: 'Create Account',
    navDashboard: 'Dashboard',
    heroTitle: 'Welcome to MAJOR DATA-LINK',
    heroDesc:
      'We offer reliable and fast digital solutions — Data, Airtime, BVN/NIN verification, and WAEC/NECO/NABTEB result checking. Contact us today for seamless online service delivery.',
    heroWhatsapp: 'Contact Us On WhatsApp',
    heroGetStarted: 'Get Started',
    servicesTitle: 'Our Services',
    servicesSubtitle: 'Pick the service you need and get started right away — straight from your account.',
    waTooltip: 'Chat on WhatsApp',
    aboutTitle: 'About Us',
    aboutSubtitle: 'MAJOR DATA-LINK is a product of Kindness Digital Branding and IT Solutions, built for fast, reliable everyday transactions.',
    about: [
      { icon: 'fa-lock', title: 'Encrypted', desc: 'Your NIN/BVN data is encrypted at rest, never stored in plain text.' },
      { icon: 'fa-bolt', title: 'Instant', desc: 'Transactions complete immediately — no waiting, no manual approval.' },
      { icon: 'fa-headset', title: 'Real Support', desc: 'Reach an actual person on WhatsApp — no ticket queues.' },
      { icon: 'fa-university', title: 'Bank-Backed Funding', desc: 'Your wallet is funded through a licensed payment processor.' },
    ],
    howTitle: 'How it Works',
    howSubtitle: 'Three steps, every time.',
    how: [
      { title: 'Fund your wallet', desc: 'Transfer to your dedicated account number — funds reflect in seconds.' },
      { title: 'Pick a service', desc: 'Data, Airtime, BVN/NIN, or Result checking — choose and confirm.' },
      { title: 'Delivered instantly', desc: 'No waiting, no manual approval — your service lands immediately.' },
    ],
    appTitle: 'Get Our App',
    appDesc: 'The full experience lives in the app — biometric login, saved beneficiaries, and instant alerts on every transaction.',
    appBtnDownload: 'Download for Android',
    appBtnWeb: 'Continue on the Web Instead',
    appNote: "Not on the Play Store yet — this installs directly. Android will ask you to allow it the first time; that's expected.",
    footerTagline: 'Fund your wallet once, top up Data, Airtime, BVN/NIN and result checking pins in seconds — no queues, no delays.',
    footerCompanyHeading: 'Company',
    footerServices: 'Services',
    footerHow: 'How it works',
    footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms & Conditions',
    footerDevHeading: 'Developers',
    footerPortal: 'API Portal',
    footerDocs: 'API Documentation',
    footerContactHeading: 'Talk to Us',
    footerChannel: 'WhatsApp Channel',
    footerRights: 'All Rights Reserved',
    footerCompanyName: 'Kindness Digital Branding and IT Solutions',
    servicePriceLabel: 'From',
    cards: {
      vtu: { title: 'VTU SERVICES', item1: 'DATA & AIRTIME', btnData: 'Buy Data', btnAirtime: 'Buy Airtime' },
      bvn: {
        title: 'BVN SERVICES',
        items: ['BVN VERIFICATION', 'BVN MODIFICATION', 'BVN CENTRAL RISK MANAGEMENT', 'BVN LICENCE ONBOARDING CREATION'],
        btn: 'Start BVN',
      },
      nin: {
        title: 'NIN SERVICES',
        items: ['NIN VERIFICATION', 'NIN BY PHONE LOOKUP', 'NIN VALIDATION / MODIFICATION'],
        btn: 'Start NIN',
      },
      result: {
        title: 'RESULT CHECKING',
        items: ['WAEC RESULT CHECKING', 'NECO RESULT CHECKING', 'NABTEB RESULT CHECKING'],
        btn: 'Check Results',
      },
      token: {
        title: 'RESULT TOKEN PURCHASE',
        items: ['NECO TOKEN', 'WAEC TOKEN', 'NABTEB TOKEN'],
        btn: 'Buy a Token',
      },
      cac: { title: 'CAC SERVICES', items: ['CAC REGISTRATIONS', 'CAC VERIFICATION'], btn: 'Start CAC' },
      jamb: {
        title: 'JAMB SERVICES',
        items: ['CBT PRACTICE SOFTWARE', 'JAMB ORIGINAL RESULT', 'JAMB ADMISSION LETTER', 'JAMB O-LEVEL UPLOAD'],
        btn: 'Start JAMB',
      },
    },
  },
} as const;

export default function LandingPage() {
  const { user } = useAuth();
  const [lang, setLang] = useState<'HA' | 'EN'>('HA');
  const [menuOpen, setMenuOpen] = useState(false);
  const [resultPrices, setResultPrices] = useState<PriceRow[]>([]);
  const [verificationPrices, setVerificationPrices] = useState<Record<string, number>>({});
  const L = TXT[lang];

  // Live backend prices, shown on the Result Checking / BVN / NIN cards so
  // the buttons on this page reflect real data from the API, not static copy.
  useEffect(() => {
    api
      .get<{ status: boolean; data: PriceRow[] }>('/public/result-prices', false)
      .then((res) => setResultPrices(res.data ?? []))
      .catch(() => setResultPrices([]));

    api
      .get<{ status: boolean; data: PriceRow[] }>('/public/verification-prices', false)
      .then((res) => {
        const map: Record<string, number> = {};
        for (const row of res.data ?? []) map[row.service] = row.unit_price;
        setVerificationPrices(map);
      })
      .catch(() => setVerificationPrices({}));
  }, []);

  const bvnFrom = verificationPrices['BVN_SLIP_STANDARD'];
  const ninFrom = verificationPrices['NIN_SLIP_STANDARD'];
  const cheapestResult = resultPrices.length
    ? Math.min(...resultPrices.map((r) => r.unit_price))
    : undefined;

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="mdl-landing">
      {/* Header */}
      <header>
        <div className="navbar">
          <Link to="/" className="logo" onClick={closeMenu}>
            <img src="/branding/logo.png" alt="" />
            MAJOR <span>DATA-LINK</span>
          </Link>

          <button
            type="button"
            className="menu-toggle"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className="fas fa-bars" />
          </button>

          <ul className={`nav-links${menuOpen ? ' active' : ''}`}>
            <li>
              <Link to="/partner-dashboard" onClick={closeMenu}>
                {L.navApi}
              </Link>
            </li>
            <li>
              <a href="#results" onClick={closeMenu}>
                {L.navResults}
              </a>
            </li>
            <li>
              <a href="#about" onClick={closeMenu}>
                {L.navAbout}
              </a>
            </li>
            <li>
              <a href="#how" onClick={closeMenu}>
                {L.navHow}
              </a>
            </li>
            <li>
              <a href="#app" onClick={closeMenu}>
                <i className="fas fa-download" /> {L.navApp}
              </a>
            </li>

            <li className="auth-buttons">
              {user ? (
                <Link to="/dashboard" className="btn-nav btn-signup" onClick={closeMenu}>
                  {L.navDashboard}
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn-nav btn-signin" onClick={closeMenu}>
                    {L.navSignin}
                  </Link>
                  <Link to="/register" className="btn-nav btn-signup" onClick={closeMenu}>
                    {L.navSignup}
                  </Link>
                </>
              )}
            </li>

            <li>
              <button
                type="button"
                className="lang-btn"
                onClick={() => setLang((v) => (v === 'HA' ? 'EN' : 'HA'))}
              >
                {lang === 'HA' ? 'EN' : 'HA'}
              </button>
            </li>
          </ul>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1>{L.heroTitle}</h1>
        <p>{L.heroDesc}</p>
        <div className="hero-buttons">
          <a
            href={whatsappLink('Sannu MAJOR DATA-LINK, ina bukatan taimako')}
            target="_blank"
            rel="noreferrer"
            className="btn-hero"
          >
            <i className="fab fa-whatsapp" /> {L.heroWhatsapp}
          </a>
          <Link to={user ? '/dashboard' : '/register'} className="btn-hero-outline">
            {L.heroGetStarted}
          </Link>
        </div>
      </section>

      {/* Services */}
      <div className="container" id="services">
        <div className="section-title">
          <h2>{L.servicesTitle}</h2>
          <p>{L.servicesSubtitle}</p>
        </div>

        <div className="services-grid">
          {/* VTU */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-mobile-alt" />
              <h3>{L.cards.vtu.title}</h3>
            </div>
            <ul className="service-list">
              <li>
                <i className="fas fa-check-circle" /> {L.cards.vtu.item1}
              </li>
            </ul>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Link to={user ? '/buy-data' : '/register'} className="btn-card" style={{ flex: 1 }}>
                {L.cards.vtu.btnData}
              </Link>
              <Link
                to={user ? '/buy-airtime' : '/register'}
                className="btn-card"
                style={{ flex: 1, background: 'var(--secondary-color)' }}
              >
                {L.cards.vtu.btnAirtime}
              </Link>
            </div>
          </div>

          {/* BVN */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-id-card" />
              <h3>{L.cards.bvn.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.bvn.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            {bvnFrom !== undefined && (
              <span className="service-price">
                {L.servicePriceLabel} ₦{bvnFrom.toLocaleString()}
              </span>
            )}
            <Link to={user ? '/bvn-services' : '/register'} className="btn-card">
              {L.cards.bvn.btn}
            </Link>
          </div>

          {/* NIN */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-fingerprint" />
              <h3>{L.cards.nin.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.nin.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            {ninFrom !== undefined && (
              <span className="service-price">
                {L.servicePriceLabel} ₦{ninFrom.toLocaleString()}
              </span>
            )}
            <Link to={user ? '/nin-services' : '/register'} className="btn-card">
              {L.cards.nin.btn}
            </Link>
          </div>

          {/* Result Checking */}
          <div className="service-card" id="results">
            <div className="service-header">
              <i className="fas fa-poll-h" />
              <h3>{L.cards.result.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.result.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            {cheapestResult !== undefined && (
              <span className="service-price">
                {L.servicePriceLabel} ₦{cheapestResult.toLocaleString()}
              </span>
            )}
            <Link to={user ? '/result-checkers' : '/register'} className="btn-card">
              {L.cards.result.btn}
            </Link>
          </div>

          {/* Token Purchase */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-key" />
              <h3>{L.cards.token.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.token.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            <Link to={user ? '/result-checkers' : '/register'} className="btn-card">
              {L.cards.token.btn}
            </Link>
          </div>

          {/* CAC */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-briefcase" />
              <h3>{L.cards.cac.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.cac.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            <Link to={user ? '/cac-registration' : '/register'} className="btn-card">
              {L.cards.cac.btn}
            </Link>
          </div>

          {/* JAMB */}
          <div className="service-card">
            <div className="service-header">
              <i className="fas fa-user-graduate" />
              <h3>{L.cards.jamb.title}</h3>
            </div>
            <ul className="service-list">
              {L.cards.jamb.items.map((item) => (
                <li key={item}>
                  <i className="fas fa-check-circle" /> {item}
                </li>
              ))}
            </ul>
            <Link to={user ? '/jamb-services' : '/register'} className="btn-card">
              {L.cards.jamb.btn}
            </Link>
          </div>
        </div>
      </div>

      {/* About Us — new section so the "Game da Mu" nav link actually goes somewhere */}
      <section className="about-section" id="about">
        <div className="container" style={{ margin: '0 auto', paddingTop: 60, paddingBottom: 60 }}>
          <div className="section-title">
            <h2>{L.aboutTitle}</h2>
            <p>{L.aboutSubtitle}</p>
          </div>
          <div className="about-grid">
            {L.about.map((item) => (
              <div className="about-card" key={item.title}>
                <i className={`fas ${item.icon}`} />
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works — new section so the "Yadda Yake Aiki" nav link actually goes somewhere */}
      <section className="how-section" id="how">
        <div className="container" style={{ margin: '0 auto', paddingTop: 60, paddingBottom: 60 }}>
          <div className="section-title">
            <h2>{L.howTitle}</h2>
            <p>{L.howSubtitle}</p>
          </div>
          <div className="how-grid">
            {L.how.map((step, i) => (
              <div className="how-card" key={step.title}>
                <div className="how-step-number">{i + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download App — new section so the "Sauke App" nav link actually goes somewhere,
          wired to the real GitHub release APK used across the rest of the app. */}
      <section className="app-section" id="app">
        <h2>{L.appTitle}</h2>
        <p>{L.appDesc}</p>
        <div className="app-buttons">
          <a href={ANDROID_APK_URL} className="btn-hero">
            <i className="fab fa-android" /> {L.appBtnDownload}
          </a>
          <Link to={user ? '/dashboard' : '/register'} className="btn-hero-outline">
            {L.appBtnWeb}
          </Link>
        </div>
        <p className="app-note">{L.appNote}</p>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-grid">
          <div>
            <h4>MAJOR DATA-LINK</h4>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 0 }}>{L.footerTagline}</p>
          </div>
          <div>
            <h4>{L.footerCompanyHeading}</h4>
            <a href="#services">{L.footerServices}</a>
            <a href="#how">{L.footerHow}</a>
            <Link to="/privacy-policy">{L.footerPrivacy}</Link>
            <Link to="/terms">{L.footerTerms}</Link>
          </div>
          <div>
            <h4>{L.footerDevHeading}</h4>
            <Link to="/partner-dashboard">{L.footerPortal}</Link>
            <Link to="/partner-docs">{L.footerDocs}</Link>
          </div>
          <div>
            <h4>{L.footerContactHeading}</h4>
            <a href={whatsappLink('Hello MAJOR DATA-LINK, I need help')} target="_blank" rel="noreferrer">
              <i className="fab fa-whatsapp" /> {CONTACT.whatsapp}
            </a>
            <a href={`mailto:${CONTACT.email}`}>
              <i className="fas fa-envelope" /> {CONTACT.email}
            </a>
            <a href={CONTACT.whatsappChannelUrl} target="_blank" rel="noreferrer">
              <i className="fas fa-broadcast-tower" /> {L.footerChannel}
            </a>
          </div>
        </div>
        <div className="bottom-bar">
          <p>
            &copy; {new Date().getFullYear()} MAJOR DATA-LINK. {L.footerRights}.
          </p>
          <p>{L.footerCompanyName}</p>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <a
        href={whatsappLink('Sannu MAJOR DATA-LINK, ina bukatan taimako')}
        className="whatsapp-float"
        target="_blank"
        rel="noreferrer"
      >
        <i className="fab fa-whatsapp" />
        <span className="tooltip-text">{L.waTooltip}</span>
      </a>
    </div>
  );
}
