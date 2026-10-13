import type { PlanSet } from "@modules/domain/platform-admin"

/** What setWorkspacePlan takes. */
export interface SetWorkspacePlanRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The plan to move to. */
    readonly planCode: string
    /** The workspace's own monthly credits; null clears it so the plan's applies. */
    readonly creditsLimit: number | null
}

/** What setWorkspacePlan answers. */
export type SetWorkspacePlanResult = Readonly<PlanSet>
