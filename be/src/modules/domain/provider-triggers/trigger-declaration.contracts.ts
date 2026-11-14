import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import type { ZodType } from "zod"

/*
 * STAGE 1 OF THE ONE EVENT PIPELINE (lane concept triggers rule 13): the ADAPTER. Every source of an event (a provider's webhook or poll,
 * the clock, a timer, the website form, the team chat, a workflow call) declares each trigger it emits as DATA plus one PURE function:
 * `translate(raw)` turns what the source received (already verified by its entry) into the canonical event, or null to drop it. It reads
 * nothing, writes nothing and calls nothing: the same raw always gives the same event. Keeping the event once (stage 2, the inbox), meeting
 * the person of its `subject` (stage 3, enrich), matching the registered graphs (stage 4) and correlating into a run (stage 5) are the
 * engine's, driven by this declaration and never by the source's code.
 */

/** How the source learns of the event: a delivery to its webhook, its own poll, the engine's clock, or an event inside NIVO. */
export type TriggerVia = "webhook" | "poll" | "clock" | "internal"

/**
 * The person an event is about, as the channel names them: the channel, the channel's own id of the person on the account the event came
 * through, and the name and picture when the source's payload gives them (absent: the payload does not say; never a guess).
 */
export interface EventSubject {
    /** The channel of the identity (`zalo`, `telegram`, `facebook`, `instagram`, `website`). */
    readonly channel: string
    /** The channel's own id of the person. */
    readonly id: string
    /** The name the payload gives, when it gives one. */
    readonly name?: string | undefined
    /** The address of the picture the payload gives, when it gives one. */
    readonly picture?: string | undefined
}

/** The canonical event a translate gives: the source's own id of the event, the person it is about when there is one, and its data. */
export interface CanonicalEvent<Data extends object = Readonly<Record<string, unknown>>> {
    /** The source's own id of the event: what keeps a repeat (a redelivery, the poll that reconciles a webhook) to one. */
    readonly id: string
    /** The person, for an event about one (a customer line); absent for any other event. */
    readonly subject?: EventSubject | undefined
    /** The event's data, in the shape the declaration's `data` schema types. */
    readonly data: Data
}

/**
 * What finds the run in flight an event joins, unless a registration declares its own key (concept triggers rule 13, stage 5): the
 * engine's route of the subject on the account (`subject`), the contact the event is about (`contact`: a workflow call's caller), one
 * member of the data (`data`), or nothing (`none`: every event its own run).
 */
export type CorrelationKey =
    | { readonly by: "subject" }
    | { readonly by: "contact" }
    | { readonly by: "data"; readonly member: string }
    | { readonly by: "none" }

/**
 * Where a raw was received: the account (connection) it came through, null for a source of the engine's own. A translate reads it as part
 * of its input (a Telegram message id is only unique inside its bot, so the line's key names the bot's account); it is never looked up.
 */
export interface TriggerOrigin {
    /** The account the raw came through, or null. */
    readonly connectionId: string | null
}

/**
 * How long a run of a key waits for the key to be quiet before it STARTS (the source's property, ROAD-HANDOVER final rule 2): each new
 * event of the key extends the window, `maxWaitMs` after the oldest pending event the run starts anyway (null: no cap). The same shape as
 * the wake's `settle` (agent-work `AgentWake.settle`). A chat message settles a few seconds, capped; every other source zero.
 */
export interface TriggerSettle {
    /** The quiet time, in milliseconds. */
    readonly windowMs: number
    /** The longest wait after the oldest pending event, in milliseconds, or null for no cap. */
    readonly maxWaitMs: number | null
}

/** One trigger a source declares: who emits it, the verb it feeds, how it is received, its two schemas, its translate and its key. */
export interface TriggerDeclaration<Raw = unknown, Data extends object = Readonly<Record<string, unknown>>> {
    /** The provider key (`zalo_oa`, `sepay`), or `nivo` for a source of the engine's own (the clock, a timer, the website form). */
    readonly provider: string
    /** The trigger's name inside its source (`message.received`, `transaction.received`). */
    readonly name: string
    /** The verb a graph registers on (`TRIGGER.*`). */
    readonly verb: TriggerVerb
    /** How the source receives it. */
    readonly via: TriggerVia
    /** The shape of what the entry hands `translate`, as the source received it. */
    readonly raw: ZodType<Raw>
    /** The shape of the canonical event's `data`. */
    readonly data: ZodType<Data>
    /**
     * The pure adapter: the canonical event of one raw (for an account event: the VALUE of the inbox row the entry kept, so the engine can
     * run it again on the stored row), or null when the source does not answer it (a seen receipt, a join). A function of its two
     * arguments only.
     */
    translate(raw: Raw, origin: TriggerOrigin): CanonicalEvent<Data> | null
    /** The default correlation key. */
    readonly key: CorrelationKey
    /** The settle time before a run of a key starts; null (or absent) = zero, the run starts at once. */
    readonly settle?: TriggerSettle | null | undefined
    /**
     * PURE, optional: this event is a person's message on its route (R26, MESSAGES-PLAN.md E3): the key the source gives the message (once
     * on the route), its words and the channel's time; null when this event is none (the release door's resume). Read on the PARSED data.
     */
    line?(data: Data): DeclaredLine | null
}

/** A person's message as its source declares it: the source's key of the message, its words, the channel's time (ISO) or null. */
export interface DeclaredLine {
    readonly key: string
    readonly text: string
    readonly at: string | null
}

/** A canonical event, or null where the source drops the raw. */
export type OptionalCanonicalEvent<Data extends object = Readonly<Record<string, unknown>>> = CanonicalEvent<Data> | null
