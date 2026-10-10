import './TrustStats.css';

export type TrustStat = { value: number; suffix?: string; label: string };

type Props = { heading: string; asOfLabel: string; asOf: string; stats: TrustStat[] };

const formatNumber = (n: number) => n.toLocaleString('en-NG');

/** Trust bar with dated, database-backed figures. Renders nothing if empty. */
export default function TrustStats({ heading, asOfLabel, asOf, stats }: Props) {
  if (stats.length === 0) return null;
  const date = new Date(`${asOf}T00:00:00`).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <section className="ts" aria-labelledby="ts-heading">
      <div className="ts-inner">
        <div className="ts-head">
          <h2 id="ts-heading" className="ts-heading">{heading}</h2>
          <p className="ts-asof">{asOfLabel}: {date}</p>
        </div>
        <dl className="ts-grid">
          {stats.map((s) => (
            <div key={s.label} className="ts-card">
              <dt className="ts-label">{s.label}</dt>
              <dd className="ts-value">
                {formatNumber(s.value)}
                {s.suffix ? <span className="ts-suffix">{s.suffix}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
