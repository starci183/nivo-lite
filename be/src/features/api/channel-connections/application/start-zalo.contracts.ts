import type { ZaloWizardConnection } from "@modules/domain/channel-connections"

/** What the StartZalo operation takes. */
export interface StartZaloRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name sent by the caller. */
    readonly name: string
    /** The appId sent by the caller. */
    readonly appId: string
    /** The appSecret sent by the caller. */
    readonly appSecret: string
}

/** What the StartZalo operation answers. */
export type StartZaloResult = ZaloWizardConnection
