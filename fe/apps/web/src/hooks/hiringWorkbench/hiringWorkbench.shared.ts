import type { HiringViews } from "@/modules/types"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"

/** Real board data and the actual lifetime of one Hiring surface. */
export interface HiringViewInput {
    readonly board: HiringWorkbenchData
    readonly copy: HiringViews["workbenchCopy"]
    readonly isActive: boolean
    readonly isReady: boolean
    readonly scope: string
    readonly focus: string | null
}

/** The chosen tab scopes each Hiring panel controller to its actual lifetime. */
export interface HiringSelectedViewInput extends HiringViewInput {
    readonly selected: HiringViews["tab"]
}
