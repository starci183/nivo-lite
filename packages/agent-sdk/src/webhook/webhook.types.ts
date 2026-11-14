import type { Bilingual } from "../module/module.types"

/** The data one occurrence of an outgoing event carries to its receivers. */
export interface WebhookEventSample {
    /** Any value the event carries. */
    readonly [name: string]: unknown
}

/** What a plugin gives `defineWebhookEvent`. */
export interface WebhookEventConfig {
    /** The event id a receiver filters on and a delivery carries, `<domain>.<verb>` (two kebab-case parts), such as `order.confirmed`. */
    readonly id: string
    /** The name the owner reads when picking the event, in both product languages. */
    readonly label: Bilingual
    /** One line on when it fires, in both product languages; absent: none. */
    readonly summary?: Bilingual | undefined
    /** The key of the module that means the event: the module whose business raises it. */
    readonly moduleKey: string
    /** The data a signed test delivery of the event carries (`test: true` is added by the host); absent: only `test: true`. */
    readonly sample?: WebhookEventSample | undefined
}

/** One outgoing business event a plugin declares: the engine lists it for subscription and routes it, and knows nothing of its meaning. */
export interface WebhookEventDefinition extends WebhookEventConfig {
    /** Discriminant. */
    readonly entry: "webhook-event"
}
