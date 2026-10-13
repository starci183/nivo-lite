import type { MetaCheck } from "@modules/domain/meta-connections"

/** What the CheckMeta operation takes. */
export interface CheckMetaRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId of the path. */
    readonly connectionId: string
    /** The repair sent by the caller. */
    readonly repair?: boolean
}

/** What the CheckMeta operation answers. */
export type CheckMetaResult = MetaCheck
