import { cn } from "@heroui/react"

/** The compose card and the list of public documents, a region step apart (GAP-5). */
export const PUBLIC_DOCS_CLASS_NAME: string | undefined = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The parts of the compose card: its words, then its buttons that wrap on phones (GAP-4). */
export const COMPOSE_CLASS_NAME: string | undefined = cn("flex", "flex-col", "gap-4")

/** The buttons of the compose card (GAP-3). */
export const COMPOSE_ACTIONS_CLASS_NAME: string | undefined = cn("flex", "flex-wrap", "items-center", "gap-2")
