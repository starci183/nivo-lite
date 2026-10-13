import { cn } from "@heroui/react"

/** QR column beside the transfer details. */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "md:grid-cols-3")
/** QR and countdown belong to the same payment instructions. */
export const QR_WRAP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-4")
/** Payment QR stays legible within the narrow track. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64")
/** Countdown ring beside its accessible text. */
export const COUNTDOWN_CLASS_NAME = cn("flex", "items-center", "gap-3")
/** Bank details form one connected section. */
export const DETAILS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "md:col-span-2")
/** Amount label beside its displayed value. */
export const COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
/** Copyable transfer fields are peers in a section. */
export const FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-4")
