import { cn } from "@heroui/react"

/** QR column beside the transfer details: a responsive two-track split no grammar structure expresses. */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "md:grid-cols-3")
/** Payment QR stays legible within the narrow track. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64")
/** Bank details span the wider track. */
export const DETAILS_CLASS_NAME = cn("min-w-0", "md:col-span-2")
