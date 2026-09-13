export default function Logo({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 sm:gap-2.5 ${className}`}>
      <img src="/branding/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover sm:h-9 sm:w-9" />
      <span
        className={`truncate font-display text-sm font-bold tracking-tight sm:text-lg ${
          dark ? 'text-cream' : 'text-ink'
        }`}
      >
        K-TECH <span className="text-gold-500">SOLUTIONS</span>
      </span>
    </div>
  );
}
