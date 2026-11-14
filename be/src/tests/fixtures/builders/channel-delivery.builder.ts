import type { DeliveryRequest } from "@modules/domain/channels"
import type { ChannelTarget } from "@modules/domain/channels/channels.contracts"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"

/** A Telegram conversation target, with the selected fields overridden for a case. */
export const target = (patch: Partial<ChannelTarget> = {}): ChannelTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555:1730000000",
    connectionId: "c-1",
    ...patch,
})

/** A Zalo conversation target, with the selected fields overridden for a case. */
export const zaloTarget = (patch: Partial<ChannelTarget> = {}): ChannelTarget =>
    target({ channel: "zalo", externalId: "user-1", ...patch })

/** The answer of a connection secret read that refuses. */
interface RefusedToken {
    /** The refusal tag. */
    readonly kind: "refused"
    /** Why the secret was refused. */
    readonly code: ConnectionSecretsErrorCode
}

export const refusedToken: RefusedToken = {
    kind: "refused",
    code: ConnectionSecretsErrorCode.NotFound,
}

/** The delivery request of the stored message msg-1 of conversation conv-1. */
export const request: DeliveryRequest = {
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    text: "Hello",
}
