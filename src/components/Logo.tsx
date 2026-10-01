import { cn } from "@/lib/utils";

/**
 * Blindspot mark — a quiet eye formed from negative space. The pupil sits
 * slightly off-center (the blind spot), inside a soft aperture ring.
 */
export function Logo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {/* aperture ring */}
      <circle cx="24" cy="24" r="21" className="stroke-current" strokeWidth="1.6" opacity="0.35" />
      {/* eye form */}
      <path
        d="M7 24c5.2-8 11.5-12 17-12s11.8 4 17 12c-5.2 8-11.5 12-17 12S12.2 32 7 24Z"
        className="stroke-current"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* pupil, deliberately offset */}
      <circle cx="26.4" cy="24" r="5.6" className="fill-current" />
      {/* the blind spot — negative space inside the pupil */}
      <circle cx="24.6" cy="22.2" r="1.7" className="fill-background" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xl font-semibold tracking-tight", className)}>
      Blindspot
    </span>
  );
}
