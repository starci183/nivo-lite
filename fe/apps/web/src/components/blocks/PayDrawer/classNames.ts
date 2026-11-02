import { cn } from "@heroui/react"

// grammar gap: the QR frame has no size prop; the same bounded width the onboarding payment screen gives its QR.
/** Width of the QR MediaFrame. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64")
