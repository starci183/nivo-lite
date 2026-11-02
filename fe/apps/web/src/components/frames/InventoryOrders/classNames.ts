import { cn } from "@heroui/react"

/** One lane: a fixed width on narrow screens, an equal share on wide ones — a measure structure cannot express. */
export const LANE_CLASS_NAME = cn("w-72", "min-w-0", "shrink-0", "lg:w-auto", "lg:flex-1")
