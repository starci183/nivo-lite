import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * A DELIVERY KIND, not a tool: sending a pre-approved TEMPLATE message to a phone number (Zalo's ZNS). It sits behind the ONE customer
 * send (`nivo.tool.customer.message.send`), which picks it by a declared delivery kind on its payload; no provider defines a tool of its own. A
 * failure is thrown with what it proves (`withProof`); a refusal the platform answered is a `providerRefusal` (a `ProviderRegistryError`).
 */

/** What a template message is asked for. */
export interface TemplateMessageRequest {
    /** The receiver's phone number, in the form the provider documents. */
    readonly phone: string
    /** The provider's id of the approved template. */
    readonly templateId: string
    /** The values of the template's parameters. */
    readonly data: Readonly<Record<string, string>>
    /** A caller's own tracking id echoed back by the provider's events, or null. */
    readonly trackingId: string | null
}

/** What the provider answers for an accepted template message. */
export interface TemplateMessageSent {
    /** The provider's id of the message, or null when it names none. */
    readonly messageId: string | null
}

/** A provider that sends a template message to a phone number. */
export interface TemplateMessagePort {
    /** The provider key. */
    readonly provider: string
    /** Sends one template message from one account. */
    sendTemplate(connection: ConnectionRecord, request: TemplateMessageRequest): Promise<TemplateMessageSent>
}
