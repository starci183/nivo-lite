import type { TriggerVerb } from "../names"
import type { JsonObject } from "../schema/schema.types"

/*
 * THE ONE EVENT PIPELINE, the graph's side (lane concept `triggers` rule 13; engine contract ROAD-API.md sections 2 to 4). A provider declares
 * its triggers and their pure `translate` in the engine (`provider-triggers/trigger-declaration.contracts.ts`); a graph REGISTERS on a verb and
 * reads what its run is handed: the trigger scope (`trigger.*`) and the run's queue (`ctx.run.queue`). This file types those two, and the
 * correlation key a registration may declare.
 */

/** The generic members of the trigger scope a correlation key may name. */
export const TRIGGER_KEY_MEMBERS = ["routeId", "contactId", "accountId", "eventId"] as const

/** The same members as a set of texts, to ask whether a text names one. */
const KEY_MEMBER_NAMES: ReadonlySet<string> = new Set(TRIGGER_KEY_MEMBERS)

/** A path into the trigger scope that names a correlation key: a generic member, or one member of `data`. */
export type TriggerKeyPath = (typeof TRIGGER_KEY_MEMBERS)[number] | `data.${string}`

/** Whether a text is a correlation key path: a generic member, or `data.<member>` (one lower camel member, no deeper). */
export const isTriggerKeyPath = (path: string): path is TriggerKeyPath =>
    KEY_MEMBER_NAMES.has(path) || /^data\.[a-z][a-zA-Z0-9]{0,63}$/u.test(path)

/**
 * The person an event is about, as the channel names them (the provider's `EventSubject`, carried into the scope as translate gave it): the
 * channel, the channel's own id of the person on the account, and what the event shows of them.
 */
export interface TriggerSubject {
    /** The channel of the identity: `zalo` | `telegram` | `facebook` | `instagram` | `website`. */
    readonly channel: string
    /** The channel's own id of the person on THIS account (Zalo user id, Telegram chat id, Meta PSID / IGSID, website visitor). */
    readonly id: string
    /** The name the event gives, when it gives one. */
    readonly name?: string | undefined
    /** The address of the picture the event gives, when it gives one. */
    readonly picture?: string | undefined
}

/**
 * THE TRIGGER SCOPE a graph reads as `trigger.*` (ROAD-API 3.1): the generic members, the same for every verb; nothing chat-specific. A
 * `workflow.called` run reads, besides, the callee contract's inputs its caller mapped, at the top of the scope, and `caller`.
 */
export interface TriggerScope {
    /** The event's id (the provider's own id of the event; an engine source's once-key). */
    readonly eventId: string
    /** The connection (account) of an account event. */
    readonly accountId?: string | undefined
    /** The contact ENRICH met (or the engine source's contact). */
    readonly contactId?: string | undefined
    /** The route ENRICH ensured for the person on the account (or the engine source's route). */
    readonly routeId?: string | undefined
    /** The event's own subject as translate gave it (a channel identity); absent for an event without one. */
    readonly subject?: TriggerSubject | undefined
    /** The event's data, plus the verb's declared reads. */
    readonly data: JsonObject
    /** The run's language. */
    readonly locale?: "vi" | "en" | undefined
}

/** One event of a run's queue (`ctx.run.queue`, ROAD-API 4): the scope its event supplied, its verb, and when it was queued (ISO). */
export type QueuedEvent = TriggerScope & {
    /** The verb the event was queued with. */
    readonly verb: TriggerVerb
    /** When the event was queued (ISO). */
    readonly at: string
}
