import type { GraphTagSource, SuppliedParam, TriggerCondition, TriggerSource } from "@nivo-lite/agent-sdk/graph"
import type { ProviderKey, TriggerVerb } from "@nivo-lite/agent-sdk/names"
import type { ZodType } from "zod"

/*
 * THE TRIGGER REGISTRY of the engine (contract C5, owner key `triggers2026_11_12`): every trigger at the head of a graph is an ENGINE verb
 * `nivo.trigger.<purpose>`; a package names only the verb, its args and its providers in priority order. Per verb the engine says what
 * its args are, whether its event is a MESSAGE (the message itself rides in the run) or a data / provider event (ids and counts only),
 * and, per provider (or `engine` for the engine's own road), how the event is received, the road its wakes arrive on, which sources of
 * the @1 envelope carry it (a channel, the engine's roads, the provider triggers of `PROVIDER_TRIGGERS`), what it SUPPLIES, and how its
 * ONE normalised event key is formed. The registry is the one table of what a verb supplies per provider: an adapter of a channel or of
 * the engine's road writes its members here; an adapter whose sources are all provider triggers supplies what its provider declares
 * (`PROVIDER_TRIGGERS`, the provider's own catalogue). The SDK's `TRIGGER_SOURCES` is read only where a @1 document is checked.
 */

/** The pseudo-provider of the engine's own roads (the clock, a timer, the team chat, a workflow call, the website form). */
export const ENGINE_ROAD = "engine"

/** Who a trigger adapter is: a provider key, or the engine's own road. */
export type TriggerAdapterProvider = ProviderKey | typeof ENGINE_ROAD

/** How an adapter learns of its event: the customer channel intake, a provider webhook, a provider poll, or the engine itself. */
export type TriggerReceiver = "channel" | "webhook" | "poll" | "engine"

/** What a verb's event carries into the run: the message itself (text, channel, conversation, form fields), or ids and counts only. */
export type TriggerPayloadKind = "message" | "ids"

/** What a verb supplies: fixed members (read per adapter from the catalogues), or what its caller maps (`workflow.called`). */
export type TriggerSupplyKind = "fixed" | "caller"

/**
 * How one adapter forms the normalised event key, the `eventKey` of the one-run dedupe `(workflowId, eventKey)`:
 * - `wake`: the wake's own key (the event reaches a workflow by exactly one road: a message id, `<triggerId>:<slot>`, `care:<task>:<at>`,
 *   `chat-tag:<msg>:<agent>`, a call key);
 * - `record`: `<prefix>:<the id the member holds>`, an id every adapter of the event carries (a bank credit: the `payment.transaction`
 *   record id, each bank feed's `transactionId`);
 * - `span`: a batch: `<prefix>:<connection>:<first id>..<last id>#<count>` over the ids the wake lists (the same batch is the same event;
 *   two batches sharing an id are two events: the provider's cursor, not the run key, keeps an id from coming twice).
 */
export type TriggerEventKeyRule =
    | { readonly kind: "wake" }
    | { readonly kind: "record"; readonly prefix: string; readonly member: string }
    | { readonly kind: "span"; readonly prefix: string; readonly member: string }

/** The provider trigger of today an adapter wraps: the PROVIDER's own event name, stored in `provider_trigger_switches.trigger_name`. */
export interface WrappedProviderTrigger {
    /** The provider key, as the catalogue declares it. */
    readonly provider: ProviderKey
    /** The provider's event name (`transaction.received`, `mail.received`): an adapter detail, never a verb. */
    readonly name: string
}

/**
 * What makes the events of one provider trigger events of the verb, where that trigger carries more than the verb means (a bank feed's
 * `transaction.received` carries money in AND money out; `payment.credit.received` is money in): the conditions every registration the
 * engine derives on that trigger carries, beside the graph's own `where`. Members of the trigger's declared payload only.
 */
export interface SourceNarrowing {
    /** The provider's event name the conditions narrow (`transaction.received`). */
    readonly trigger: string
    /** The conditions: the verb's own meaning on that trigger (`direction` equals `in`). */
    readonly where: readonly [TriggerCondition, ...Array<TriggerCondition>]
}

/**
 * The canonical form a stream fact is compared in (no fuzzy matching: two keys are the same stream exactly when the strings are equal):
 * `digits` keeps the digits only (an account number written with spaces or dashes), `upper-case` and `lower-case` trim and change the
 * case (a bank code, a mailbox address), `trimmed` trims (an id the provider gave).
 */
export type StreamFactForm = "digits" | "upper-case" | "lower-case" | "trimmed"

/** One public fact of a connection (`connections.public_meta`) that is part of its stream's identity, and its canonical form. */
export interface StreamFact {
    /** The member of the connection's public facts. */
    readonly key: string
    /** How it is compared. */
    readonly form: StreamFactForm
}

/**
 * What identifies the STREAM one account of an adapter reads (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: one source per
 * underlying stream): the stream's kind and the public facts its key is formed of, in order (`<kind>:<fact>:<fact>`). An account missing
 * any of them reads an unknown stream, which is its own (keyed by the connection id) and never matched to another. An adapter whose
 * events are only ever the account's own (a compose account's renders: no two accounts report one render) declares `ownAccount`: every
 * account is its own stream BY DESIGN, so nothing is ever contested or picked.
 */
export type StreamIdentity =
    | {
          /** The kind of stream (`bank-account`, `mailbox`, `zalo-oa`): accounts of two providers of one kind can read one stream. */
          readonly kind: string
          /** The facts, in key order. Never empty. */
          readonly facts: readonly [StreamFact, ...Array<StreamFact>]
      }
    | {
          /** The kind of stream (`compose-account`): named for the documentation; never compared. */
          readonly kind: string
          /** Every account is its own stream (`connection:<id>`). */
          readonly ownAccount: true
      }

/** One adapter of a verb: one provider (or the engine) and how it carries the event. */
export interface TriggerAdapterSpec {
    /** The provider, or `engine`. */
    readonly provider: TriggerAdapterProvider
    /** How it learns of the event. */
    readonly receivedBy: TriggerReceiver
    /** The road (`GraphTagSource`) the wakes of every one of its sources arrive on. */
    readonly road: GraphTagSource
    /**
     * What a wake of the adapter supplies whichever of its sources brings it: the registry's own members for a channel or the engine's road;
     * absent only where every source is a provider trigger, whose provider declares what it supplies.
     */
    readonly supplies?: ReadonlyArray<SuppliedParam> | undefined
    /** The sources of today that carry the event to a graph, in order. Never empty. */
    readonly sources: readonly [TriggerSource, ...Array<TriggerSource>]
    /**
     * The system tag source (the tag wake's source, the scope's `source`) the engine-road wakes of this adapter arrive with, where the
     * road is `system-event` and the wake names no provider trigger; absent where the road alone or the provider trigger names the verb.
     */
    readonly tagSource?: string | undefined
    /** How the normalised event key is formed. */
    readonly eventKey: TriggerEventKeyRule
    /**
     * The provider triggers among `sources` that carry more than the verb, each with the conditions that keep the verb's events only;
     * absent where every source carries exactly the verb.
     */
    readonly narrows?: ReadonlyArray<SourceNarrowing> | undefined
    /** What identifies the stream an account of this provider reads; absent for the engine's own road (no account, no stream). */
    readonly stream?: StreamIdentity | undefined
}

/** The args a package writes beside a verb, as their schema reads them (an optional member may be absent). */
export type TriggerArgs = Readonly<Record<string, unknown>>

/**
 * The DECLARED payload a verb's run is handed beyond the ids its wake carries (generic, no business): the supplied member whose value is
 * the id of a stored row (`member`), the account data purpose of the row types that hold it (`purpose`, as each provider's type declares
 * it), and each member the run reads with the row field it is filled from, as stored (`fills`, with the member's type). The wake still
 * carries ids only; the engine fills these members from the row when the run starts, a member whose field the row lacks is left out.
 */
export interface TriggerRowRead {
    /** The supplied member that holds the row's id. */
    readonly member: string
    /** The purpose of the row types (`bank.transaction`). */
    readonly purpose: string
    /** Each declared member: the row field it is filled from and its type. */
    readonly fills: ReadonlyArray<{ readonly name: string; readonly field: string; readonly type: SuppliedParam["type"] }>
}

/** One verb of the registry. */
export interface TriggerSpec {
    /** The verb. */
    readonly verb: TriggerVerb
    /** The schema of the args a package writes beside the verb (`clock.tick`: `{ preset, at? }`; every other verb: none). */
    readonly args: ZodType<TriggerArgs>
    /** What the event carries into the run. */
    readonly payload: TriggerPayloadKind
    /** What it supplies. */
    readonly supply: TriggerSupplyKind
    /**
     * The supplied members whose value identifies the SUBJECT of a run the event wakes, most specific first (the first one present
     * names it): while a run of a workflow for a subject waits at an open stop, the next event of that workflow for the same subject
     * joins that run instead of opening another. Empty for a verb whose events name no subject (the clock): each starts its own run.
     * Data of the registry, never a member name matched by words.
     */
    readonly subject: ReadonlyArray<string>
    /** The members the engine fills from the row the event's id names (`TriggerRowRead`); absent: the wake's members only. */
    readonly reads?: TriggerRowRead | undefined
    /** The adapters, in the engine's order; a provider absent here does not serve the verb (`TRIGGER_UNKNOWN` at that provider). */
    readonly adapters: readonly [TriggerAdapterSpec, ...Array<TriggerAdapterSpec>]
}

/** The road a wake arrives on (`GraphTagSource`) with the scope its trigger reads: what `verbOfWake` derives the verb from. */
export interface WakeFacts {
    /** The road. */
    readonly road: GraphTagSource
    /** The trigger scope (`triggerScopeOf`): its `source` member is the system tag source, `providerTrigger` the provider trigger. */
    readonly scope: Readonly<Record<string, unknown>>
}

/** One account trigger switch as readiness reads it (a row of `provider_trigger_switches`). */
export interface TriggerSwitchRow {
    /** The provider's event name. */
    readonly triggerName: string
    /** Whether it is on. */
    readonly enabled: boolean
}

/**
 * The reader of the account trigger switches, as readiness needs it: the switches of one account. Its shape is the one of
 * `ProviderTriggerStoreService.listOf`, so the capability that owns the switches binds it with one `useExisting`.
 */
export interface TriggerSwitchReader {
    /** The trigger switches of one connection, as stored. */
    listOf(workspaceId: string, connectionId: string): Promise<ReadonlyArray<TriggerSwitchRow>>
}

/** The fields of a stored row or of a trigger scope, by name; a member the row does not hold is absent. */
export interface TriggerFields {
    /** One field, as stored. */
    readonly [field: string]: unknown
}

/** A trigger spec, or undefined for a verb the registry does not know. */
export type OptionalTriggerSpec = TriggerSpec | undefined

/** An adapter, or undefined where the provider does not serve the verb. */
export type OptionalTriggerAdapterSpec = TriggerAdapterSpec | undefined

/** A provider named for one lookup, or undefined for the engine's own road. */
export type OptionalProviderKey = ProviderKey | undefined

/** A provider key, or null for a source of the engine's own road or one the registry does not wrap. */
export type OptionalSourceProvider = ProviderKey | null

/** The road a source's wakes arrive on, or null for a kind the registry does not wrap. */
export type OptionalSourceRoad = GraphTagSource | null

/** The verb of a source or of a wake, or null when the registry wraps none. */
export type OptionalTriggerVerb = TriggerVerb | null

/** Who carries a verb's events: the engine's own road, a provider, or nobody (no spec). */
export type TriggerCarrier = "engine" | "provider" | "unknown"
