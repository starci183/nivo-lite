import type { MetaWizardConnection } from "@modules/domain/meta-connections"

/** What the ResumeMeta operation takes. */
export interface ResumeMetaRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
}

/** What the ResumeMeta operation answers. */
export type ResumeMetaResult = MetaWizardConnection
