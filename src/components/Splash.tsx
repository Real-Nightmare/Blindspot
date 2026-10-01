import { useEffect, useMemo, useState } from "react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const PHRASES = [
  "You won't believe it...",
  "Not everything needs to be seen.",
  "Welcome somewhere quieter.",
  "The blind spot is never empty.",
  "Somewhere between privacy and presence.",
  "Speak softly, honestly.",
  "What happens here stays here.",
];

/**
 * Shows while the auth/Convex handshake initializes. The phrase is chosen
 * once per startup. No artificial delay — the parent hides it when init
 * finishes.
 */
export function Splash({ hidden }: { hidden: boolean }) {
  const phrase = useMemo(() => PHRASES[Math.floor(Math.random() * PHRASES.length)], []);
  const [gone, setGone] = useState(false);
  const leaving = hidden;

  useEffect(() => {
    if (!hidden) return;
    // Schedule removal once. The timeout must NOT be cleared by a `leaving`
    // state change — with `leaving` in the deps, React ran this effect's
    // cleanup right after setLeaving, cancelling the timeout and leaving an
    // invisible full-viewport block above the page forever (the "huge blank
    // space" bug).
    const t = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(t);
  }, [hidden]);

  if (gone) return null;
  return (
    <div
      className={cn(
        "grain relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-background transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      )}
      aria-hidden={leaving}
    >
      <div className="animate-breathe text-foreground">
        <Logo size={72} />
      </div>
      <p className="animate-pulse-soft font-display text-lg italic text-muted-foreground">
        {phrase}
      </p>
    </div>
  );
}
