import { useState } from 'react';
import { Copy, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { EXAM_RESULT_SITES, type CheckableExam } from '../lib/exam-result-sites';

export type ExamCard = { pin: string; serial: string };

/**
 * The official result portal, framed inside the app, with the customer's own
 * token/PIN and serial number beside it to copy. Their details are typed into
 * the exam body's page, not ours - this is a cross-origin frame, so nothing the
 * customer enters there is visible to us.
 *
 * We cannot tell from here whether the exam body's site allows being framed or
 * keeps its session cookies inside a frame, so "Open in a new tab" is always on
 * screen as the way out.
 */
export default function ExamResultChecker({ exam, cards }: { exam: CheckableExam; cards: ExamCard[] }) {
  const site = EXAM_RESULT_SITES[exam];
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState('');

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  }

  return (
    <section aria-label={`Check ${exam} result`} className="space-y-4">
      {cards.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((card, index) => (
            <div key={`${card.pin}-${index}`} className="rounded-xl border border-parchment-line bg-white p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">{cards.length > 1 ? `Card ${index + 1}` : 'Your card'}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 font-mono">
                <span className="font-sans text-xs text-ink-600">{site.credentialLabel}:</span>
                <strong className="break-all">{card.pin}</strong>
                <button type="button" aria-label={`Copy ${site.credentialLabel}`} onClick={() => void copy(card.pin, `pin-${index}`)} className="rounded-full bg-parchment p-1.5 text-ink-600 hover:bg-gold-50">
                  <Copy size={13} />
                </button>
                {copied === `pin-${index}` && <span className="font-sans text-xs text-emerald-700">Copied</span>}
              </p>
              {card.serial && (
                <p className="mt-1 flex flex-wrap items-center gap-2 font-mono">
                  <span className="font-sans text-xs text-ink-600">Serial No:</span>
                  <strong className="break-all">{card.serial}</strong>
                  <button type="button" aria-label="Copy serial number" onClick={() => void copy(card.serial, `serial-${index}`)} className="rounded-full bg-parchment p-1.5 text-ink-600 hover:bg-gold-50">
                    <Copy size={13} />
                  </button>
                  {copied === `serial-${index}` && <span className="font-sans text-xs text-emerald-700">Copied</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-cream p-3 text-sm text-ink-600">Use the {site.credentialNoun} and serial number from your purchase on the page below.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-parchment-line bg-white">
        <iframe
          key={reloadKey}
          src={site.url}
          title={site.name}
          className="block h-[70vh] min-h-[520px] w-full"
          // Keeps the exam site's forms, scripts and session working while
          // stopping it from navigating our whole page away (frame-busting).
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a href={site.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-gold-500 px-4 py-2.5 font-semibold text-ink">
          <ExternalLink size={15} />Open in a new tab
        </a>
        <button type="button" onClick={() => setReloadKey((n) => n + 1)} className="flex items-center gap-1.5 rounded-xl border border-parchment-line bg-white px-4 py-2.5 font-semibold text-ink">
          <RefreshCw size={15} />Reload
        </button>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-ink-600">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        This is the official {site.name}. If the page stays blank or will not accept your details here, your browser or the exam body is blocking it inside another website: use "Open in a new tab" instead.
      </p>
    </section>
  );
}
