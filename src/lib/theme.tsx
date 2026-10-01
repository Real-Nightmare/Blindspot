import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark" | "system";
type Density = "comfortable" | "compact";
type Motion = "normal" | "reduced";

type ThemeState = {
  mode: ThemeMode;
  density: Density;
  motion: Motion;
  setMode: (m: ThemeMode) => void;
  setDensity: (d: Density) => void;
  setMotion: (m: Motion) => void;
};

const ThemeCtx = createContext<ThemeState | null>(null);

function apply(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (localStorage.getItem("bs-theme") as ThemeMode) ?? "dark");
  const [density, setDensityState] = useState<Density>(() => (localStorage.getItem("bs-density") as Density) ?? "comfortable");
  const [motion, setMotionState] = useState<Motion>(() => (localStorage.getItem("bs-motion") as Motion) ?? "normal");

  useEffect(() => {
    apply(mode);
    localStorage.setItem("bs-theme", mode);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => mode === "system" && apply(mode);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("bs-density", density);
    document.documentElement.dataset.density = density === "compact" ? "compact" : "";
  }, [density]);

  useEffect(() => {
    localStorage.setItem("bs-motion", motion);
    document.documentElement.dataset.reducedMotion = motion === "reduced" ? "true" : "false";
  }, [motion]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const setDensity = useCallback((d: Density) => setDensityState(d), []);
  const setMotion = useCallback((m: Motion) => setMotionState(m), []);

  return (
    <ThemeCtx.Provider value={{ mode, density, motion, setMode, setDensity, setMotion }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
