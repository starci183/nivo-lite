import type { MetaAuthorization } from "@modules/domain/meta-connections"

/** What the MetaAuthorize operation takes. */
export interface MetaAuthorizeRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connectionId sent by the caller. */
    readonly connectionId?: string
}

/** What the MetaAuthorize operation answers. */
export type MetaAuthorizeResult = MetaAuthorization
