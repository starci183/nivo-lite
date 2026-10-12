import type { ZaloWizardConnection } from "@modules/domain/channel-connections"

/** What the ResumeZalo operation takes. */
export interface ResumeZaloRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the ResumeZalo operation answers. */
export type ResumeZaloResult = ZaloWizardConnection
