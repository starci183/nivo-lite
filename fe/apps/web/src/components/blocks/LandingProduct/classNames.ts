/** In-page anchor targets clear the sticky top bar when a nav link scrolls to them. */
export const ANCHOR = "scroll-mt-16"
/** Blocks inside one section: heading, then content. */
export const SECTION_STACK = "flex min-w-0 flex-col gap-4"
/** Desktop panel: tabs, framed shot, title and bullets. Hidden on phones, where the stack shows every view. */
export const PRODUCT_DESKTOP = "hidden min-w-0 flex-col gap-4 md:flex"
/** Panel title beside its three benefits. */
export const PRODUCT_COPY = "grid grid-cols-2 gap-6"
/** Benefit list rows. */
export const BULLETS = "flex flex-col gap-3"
/** Phone stack: one entry per view. */
export const PRODUCT_STACK = "flex min-w-0 flex-col gap-8 md:hidden"
/** One view of the phone stack. */
export const VIEW_STACK = "flex min-w-0 flex-col gap-4"
