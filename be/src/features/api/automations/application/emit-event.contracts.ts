import type { BusinessEventInput } from "@modules/domain/automations"

/** What emit event takes. */
export interface EmitEventRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The event. */
    readonly event: BusinessEventInput
}

/** What emit event answers. */
export type EmitEventResult = void
