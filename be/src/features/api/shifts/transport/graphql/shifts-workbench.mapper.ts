import type { ShiftsBenchView, ShiftsMineView } from "@modules/domain/shifts"
import type { ShiftsMineRequest } from "../../application/shifts-mine.contracts"
import type { ShiftsWorkbenchRequest } from "../../application/shifts-workbench.contracts"
import type { ShiftsBenchType } from "./dto/shifts-bench.type"
import type { ShiftsMineType } from "./dto/shifts-mine.type"

/** Maps the workspace scope and week to the workbench request. */
export const toShiftsWorkbenchRequest = (workspaceId: string, week?: string): ShiftsWorkbenchRequest => ({
    workspaceId,
    week,
})

/** Maps the workspace scope to the own-view request. */
export const toShiftsMineRequest = (workspaceId: string): ShiftsMineRequest => ({ workspaceId })

/** Maps the workbench view to the GraphQL type. */
export const toShiftsBenchType = (result: ShiftsBenchView): ShiftsBenchType => result

/** Maps the own view to the GraphQL type. */
export const toShiftsMineType = (result: ShiftsMineView): ShiftsMineType => result
