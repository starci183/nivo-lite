import { cn } from "@heroui/react"

/** The payment step caps its own width under the page measure — a measure structure cannot express. */
export const MEASURE_CLASS_NAME: string | undefined = cn("w-full", "max-w-3xl")
/** Outcome copy reads centred — text alignment is not a spacing role. */
export const CENTERED_CLASS_NAME: string | undefined = cn("text-center")
/** The decorative image stays small beside the outcome copy. */
export const MASCOT_CLASS_NAME: string | undefined = cn("w-40")
