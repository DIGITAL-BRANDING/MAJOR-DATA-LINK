import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import './HeroSlider.css';

export type HeroSlide = {
  /** First part of the headline, shown in dark text. */
  dark: string;
  /** Second part of the headline, shown in the accent colour. */
  accent: string;
  desc: string;
  image: string;
  alt: string;
};

type Props = {
  slides: HeroSlide[];
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel: string;
  secondaryTo: string;
  prevLabel: string;
  nextLabel: string;
  ariaLabel: string;
  autoplayMs?: number;
};

/**
 * Full-width animated hero: one slide per product area, auto-advancing,
 * with arrows, dots, swipe on touch, pause on hover/focus, and no motion for
 * users who ask the OS to reduce it.
 */
export default function HeroSlider({
  slides,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
  prevLabel,
  nextLabel,
  ariaLabel,
  autoplayMs = 6000,
}: Props) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), autoplayMs);
    return () => window.clearInterval(timer);
  }, [paused, count, autoplayMs]);

  if (count === 0) return null;

  function onTouchStart(e: TouchEvent) {
    touchStart.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStart.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 50) return;
    go(delta < 0 ? index + 1 : index - 1);
  }

  return (
    <section
      className="hs"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        const Heading = i === 0 ? 'h1' : 'h2';
        return (
          <div
            key={slide.dark + i}
            className={`hs-slide${active ? ' is-active' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={!active}
          >
            <div className="hs-inner">
              <div className="hs-text">
                <Heading className="hs-title">
                  <span className="hs-dark">{slide.dark}</span>{' '}
                  <span className="hs-accent">{slide.accent}</span>
                </Heading>
                <p className="hs-desc">{slide.desc}</p>
                <div className="hs-cta">
                  <Link to={primaryTo} className="hs-btn hs-btn-primary" tabIndex={active ? 0 : -1}>
                    {primaryLabel}
                  </Link>
                  <Link to={secondaryTo} className="hs-btn hs-btn-secondary" tabIndex={active ? 0 : -1}>
                    {secondaryLabel}
                  </Link>
                </div>
              </div>
              <div className="hs-media">
                <img src={slide.image} alt={slide.alt} loading={i === 0 ? 'eager' : 'lazy'} />
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button type="button" className="hs-arrow hs-prev" aria-label={prevLabel} onClick={() => go(index - 1)}>
            <span aria-hidden="true">&#8249;</span>
          </button>
          <button type="button" className="hs-arrow hs-next" aria-label={nextLabel} onClick={() => go(index + 1)}>
            <span aria-hidden="true">&#8250;</span>
          </button>
          <div className="hs-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`hs-dot${i === index ? ' is-active' : ''}`}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
