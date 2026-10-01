import { cn } from "@heroui/react"

export const RIBBON_WRAP = cn("relative", "h-full", "overflow-hidden", "rounded-lg")
export const RIBBON = "pointer-events-none absolute right-[-3.25rem] top-7 z-10 w-52 rotate-45 bg-[#fb7185] py-1 whitespace-nowrap text-center text-xs font-semibold text-[#0f172a]"
export const OFFER_LINE = cn("flex", "flex-col", "gap-1")
export const SUMMARY_LIST = cn("m-0", "flex", "flex-col", "p-0")
export const SUMMARY_ROW = cn("flex", "flex-wrap", "items-baseline", "justify-between", "gap-2", "border-b", "border-separator", "py-2", "last:border-b-0")
export const SUMMARY_VALUE = cn("min-w-0", "text-end")
export const PROMO_ROW = cn("flex", "flex-wrap", "items-center", "gap-3", "border-b", "border-separator", "pb-4", "mb-4")
export const PROMO_COPY = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
export const PROMO_ACTIONS = cn("flex", "items-center", "gap-2")
export const NUDGE = cn("flex", "flex-wrap", "items-center", "gap-3", "border-s-2", "border-separator", "ps-4")
export const CORAL_MARK = "rounded-sm bg-[#fb7185] px-2 py-0.5 text-xs font-semibold text-[#0f172a]"
export const WELCOME = "relative isolate overflow-hidden rounded-lg bg-gradient-to-r from-[#0f172a] via-[#1e1b2e] to-[#7f1d1d] text-white"
export const WELCOME_GRID = "relative z-10 flex flex-wrap items-center gap-4 p-6"
export const WELCOME_COPY = "min-w-0 flex-1 basis-64"
export const WELCOME_TITLE = "text-xl font-bold leading-tight md:text-2xl"
export const WELCOME_TEXT = "mt-1 max-w-xl text-sm text-white/80"
export const WELCOME_ACTIONS = "mt-4 flex flex-wrap items-center gap-3"
export const WELCOME_ART = "pointer-events-none hidden h-28 w-auto select-none md:block"
export const WELCOME_PRIMARY = "inline-flex h-11 items-center justify-center rounded-lg bg-[#e11d48] px-5 text-sm font-medium text-white hover:bg-white hover:text-[#7f1d1d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb7185]"
export const WELCOME_LINK = "inline-flex h-11 items-center justify-center rounded-lg border border-white/30 px-5 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb7185]"
export const WELCOME_CLOSE = "absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#fb7185]"
export const OFFICE_PROMO = cn("flex", "flex-wrap", "items-center", "gap-3", "rounded-lg", "border", "border-separator", "bg-surface-secondary", "p-4")
export const PROMO_MASCOT = "pointer-events-none hidden h-12 w-auto shrink-0 select-none sm:block"
export const SR_ONLY = cn("sr-only")
