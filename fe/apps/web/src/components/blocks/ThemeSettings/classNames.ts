import { cn } from "@heroui/react"

/** The preview frame: the card's own padding around the sample; the frame's colours come from the scoped stylesheet of the draft. */
export const previewFrameClassName = (scopeClass: string, mode: "light" | "dark"): string =>
    cn("p-4", scopeClass, mode) ?? ""
