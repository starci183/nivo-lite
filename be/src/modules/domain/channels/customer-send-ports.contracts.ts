import type { ConnectionRecord } from "@modules/domain/connections"
import type { ChannelTarget, DeliveryRequest, DeliveryResult, PersonMessage } from "./channels.contracts"

/**
 * One customer send as a provider's port takes it: the delivery request plus the moment the caller sends it (the caller's clock; a
 * sandbox implementation has none of its own, so it judges the reply window against this moment).
 */
export interface CustomerSendRequest extends DeliveryRequest {
    /** The moment of the send, read from the caller's clock. */
    readonly at: Date
}

/**
 * A messaging provider's customer SEND on one of its accounts (the API operation "send a message to a person", level 1 of providers rule
 * 13). The account decides the implementation: the registry's `portFor(account)` answers the live route (the provider's real host, its
 * window and notice rules) for a live account and the provider's sandbox twin for a sandbox account, never the live one.
 */
export interface CustomerSendPort {
    /** The provider key of the accounts it sends through (`zalo_oa`). */
    readonly provider: string
    /**
     * Sends one reply to the person on the account and answers what the channel said. A refusal of the channel is an answer (a
     * `DeliveryResult` that is not delivered), never a throw, except what the live route throws (a busy Zalo token refresh).
     */
    send(
        account: ConnectionRecord,
        target: ChannelTarget,
        userId: string | null,
        request: CustomerSendRequest,
    ): Promise<DeliveryResult>
    /**
     * Sends one text to a PERSON of the account outside any conversation (a message to a staff member) and throws when it did not go
     * out, so the caller records the failure. No reply window applies: the person is staff, not a customer. A provider without it
     * has no staff channel: the engine answers its "connection not found".
     */
    sendToPerson?(account: ConnectionRecord, request: PersonMessage): Promise<void>
    /** The person's name on the channel, or an empty text when the channel will not say. A provider without it names nobody. */
    nameOf?(account: ConnectionRecord, personId: string): Promise<string>
    /** Shows "typing" in the person's chat while the AI works; a provider without it has none. A failure here never stops the reply. */
    showTyping?(account: ConnectionRecord, personId: string): Promise<void>
}
