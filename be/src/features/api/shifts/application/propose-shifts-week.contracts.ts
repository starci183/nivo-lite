import type { ProposeWeekParams } from "@modules/domain/shifts"

/** What build a draft schedule for the week that contains a day takes. */
export interface ProposeShiftsWeekRequest extends ProposeWeekParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
