import type { ExplainScheduleParams } from "@modules/domain/shifts"

/** What write the explanation of a schedule again takes. */
export interface ExplainShiftsScheduleRequest extends ExplainScheduleParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
