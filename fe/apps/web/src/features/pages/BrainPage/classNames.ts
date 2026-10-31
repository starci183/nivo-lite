import { cn } from "@heroui/react"

/** Vertical rhythm between the heading, the pipeline, the tabs and the open tab (GAP-5: page regions). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6")

/** The dossiers tab fills the region edge to edge; its panes own their insets. */
export const BLEED_PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col")

/** The open tab; its regions keep the page rhythm (GAP-5). */
export const PANEL_CLASS_NAME = cn("flex", "flex-col", "gap-6")

/** The documents and the way in beside the ideas of what to add: one column on phones, two from desktop (GAP-3). */
export const SOURCES_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "lg:grid-cols-[minmax(0,1fr)_20rem]")

/** The way in and the list of documents stack (GAP-5). */
export const SOURCES_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The ideas and the link to the base knowledge stack beside the list (GAP-5). */
export const SOURCES_SIDE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
