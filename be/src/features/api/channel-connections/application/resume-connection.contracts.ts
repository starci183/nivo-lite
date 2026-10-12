import type { WizardConnection } from "@modules/domain/channel-connections"

/** What the ResumeConnection operation takes. */
export interface ResumeConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the ResumeConnection operation answers. */
export type ResumeConnectionResult = WizardConnection
