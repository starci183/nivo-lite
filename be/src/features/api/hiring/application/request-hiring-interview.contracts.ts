import type { RequestInterviewParams } from "@modules/domain/hiring"

/** What arrange an interview for a candidate takes. */
export interface RequestHiringInterviewRequest extends RequestInterviewParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
