import type { TelegramConnected } from "@modules/domain/channel-connections"

/** What the ConnectTelegram operation takes. */
export interface ConnectTelegramRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The name sent by the caller. */
    readonly name: string
    /** The token sent by the caller. */
    readonly token: string
}

/** What the ConnectTelegram operation answers. */
export type ConnectTelegramResult = TelegramConnected
