import { cn } from "@heroui/react"

/** Visually hides the rail heading while retaining its landmark semantics. */
export const RAIL_HEADING_CLASS_NAME = cn("sr-only")

/** Root class for the responsive navigation rail. */
export const RAIL_CLASS_NAME = cn("collapsible-rail")

/** Class for the keyboard-accessible rail toggle. */
export const RAIL_CONTROL_CLASS_NAME = cn("collapsible-rail-control", "size-11", "rounded-full")
