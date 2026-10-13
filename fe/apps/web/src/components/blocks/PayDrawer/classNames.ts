import { cn } from "@heroui/react"

/** Lines of one entry (GAP-1). */
export const COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** QR code over the transfer details (GAP-4). */
export const PAY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** QR code, its title and the countdown (GAP-4). */
export const QR_WRAP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-3")
// grammar gap: the QR frame has no size prop; the same bounded width the onboarding payment screen gives its QR.
/** Width of the QR MediaFrame. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64")
