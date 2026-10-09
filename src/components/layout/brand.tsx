import { cn } from "@/lib/utils";

/** Neighbourlink mark: a home node linked to its neighbours. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid place-items-center size-8 rounded-[9px] bg-ink text-canvas shadow-[inset_0_-1px_0_oklch(0_0_0/0.25)]",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none">
        <path
          d="M12 12 5.5 7M12 12l6.5-4.5M12 12v7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="5.5" cy="7" r="2.1" fill="currentColor" />
        <circle cx="18.5" cy="7.5" r="2.1" fill="currentColor" />
        <circle cx="12" cy="19" r="2.1" fill="currentColor" />
        <circle cx="12" cy="12" r="3" className="fill-accent" />
      </svg>
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <BrandMark />
      {!compact && (
        <div className="leading-none min-w-0">
          <div className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
            Neighbourlink
          </div>
          <div className="nl-eyebrow mt-1 !text-[9.5px]">Kolkata · demo data</div>
        </div>
      )}
    </div>
  );
}
