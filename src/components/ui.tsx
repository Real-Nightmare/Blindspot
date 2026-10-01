import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

// ------------------------------------------------------------------ Button ---

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        {
          "primary": "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
          "secondary": "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:scale-[0.98]",
          "ghost": "text-foreground hover:bg-muted active:scale-[0.98]",
          "danger": "bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98]",
          "accent": "bg-accent text-accent-foreground hover:opacity-90 active:scale-[0.98]",
        }[variant],
        {
          sm: "h-8 px-3 text-xs",
          md: "h-10 px-4 text-sm",
          lg: "h-12 px-6 text-base",
          icon: "h-9 w-9",
        }[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ------------------------------------------------------------------- Input ---

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-10 w-full rounded-lg border border-input bg-card px-3 text-sm placeholder:text-muted-foreground/60 transition-colors hover:border-muted-foreground/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/60 transition-colors hover:border-muted-foreground/40 disabled:opacity-50 resize-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "focus-ring h-10 w-full rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:border-muted-foreground/40 disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

// ------------------------------------------------------------------- Card ---

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-semibold leading-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

// ------------------------------------------------------------------ Badge ---

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          neutral: "bg-muted text-muted-foreground",
          accent: "bg-accent/15 text-accent",
          success: "bg-success/15 text-success",
          warning: "bg-warning/15 text-warning",
          danger: "bg-destructive/15 text-destructive",
        }[tone],
        className,
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------------------ Avatar ---

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { xs: "h-6 w-6 text-[9px]", sm: "h-8 w-8 text-[10px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" }[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground select-none",
        dims,
        className,
      )}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name || "?")
      )}
    </span>
  );
}

// ------------------------------------------------------------------- Misc ---

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
        checked ? "bg-accent" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground/90">
      {children}
    </label>
  );
}
