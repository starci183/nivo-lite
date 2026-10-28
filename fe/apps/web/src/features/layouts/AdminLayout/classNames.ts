import { cn } from "@heroui/react"

/** The console bar placed above the routed page: the page inset on its sides and one region step below it, as the routed page's own `Page` insets its band (GAP-5). */
export const BAR_CLASS_NAME = cn(
    "w-full",
    "min-w-0",
    "px-[var(--grammar-page-inset,clamp(1rem,3vw,2rem))]",
    "pb-[var(--grammar-region-gap,1.5rem)]",
)
