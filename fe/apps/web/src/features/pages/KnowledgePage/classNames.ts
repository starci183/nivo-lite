import { cn } from "@heroui/react"

/** Vertical rhythm between the heading, the documents, the question panel and the ideas (GAP-5: page regions). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6")

/** The links under the heading and the button that adds documents sit on one line and wrap on phones (GAP-3). */
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3")
