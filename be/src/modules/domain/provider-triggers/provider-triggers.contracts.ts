import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import type { EntityManager } from "typeorm"
import type { KeptFile } from "./trigger-delivery.policy"
import type { CanonicalEvent, TriggerDeclaration } from "./trigger-declaration.contracts"

/*
 * LEVEL 3 OF A PROVIDER: ITS TRIGGERS. A provider has three levels over its connection: an API the interface calls, tools an agent
 * calls through the gateway, and triggers its own background work (a webhook handler, a poll) emits. A trigger is declared in code by
 * the provider (`PROVIDER_TRIGGERS`): its name, how it is emitted, the typed payload (ids and counts only, never a customer's words),
 * how events are grouped into runs and how a missed event is recovered. Each account has a switch per trigger, OFF until the owner
 * turns it on; an account whose switch is off does no work. A workflow registers on a trigger through a trigger source of kind
 * `provider`; the one emit point `ProviderTriggersService.fire` hands an event to the agents that are attached to the account and have
 * an active workflow registered: ONE of them decides (books money, answers), every other one is told (a notice) and may only act on
 * the records of its own system.
 */

/** A label in the owner's two languages. */
export interface TriggerWords {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The type of one payload field. A payload holds ids, counts and closed choices: there is no free text type. */
export type TriggerFieldType = "id" | "integer" | "choice"

/** One field of a trigger's payload, with what it means for the documentation the interface renders. */
export interface TriggerField {
    /** The name, as a workflow reads it (`trigger.<name>`) and a filter names it. */
    readonly name: string
    /** Its type. */
    readonly type: TriggerFieldType
    /** The closed values of a `choice`. */
    readonly of?: ReadonlyArray<string> | undefined
    /** What it means, in the owner's two languages. */
    readonly description: TriggerWords
    /** True when a workflow's filter may compare it (a closed choice); an id or a count is never filtered on here. */
    readonly filterable: boolean
}

/** How the events of one emission are grouped into runs for a registered workflow. */
export type TriggerBatching =
    /** One run per event; the payload fields are the run's params. */
    | { readonly mode: "each" }
    /** One run per emission, in groups of at most `maxEvents`; the run's params are `eventIds` and `count`. */
    | { readonly mode: "list"; readonly maxEvents: number }

/** How an event that was not handed over is recovered: the reader's own cursor, the provider's reconcile pass, or nothing. */
export type TriggerRecovery = "cursor" | "reconcile" | "none"

/** One trigger a provider declares. */
export interface ProviderTriggerDeclaration {
    /** The provider key (`sepay`, `imap`). */
    readonly provider: string
    /** The name inside the provider (`transaction.received`). */
    readonly name: string
    /** How the provider's background work learns of it. */
    readonly kind: "webhook" | "poll"
    /** What it is, in the owner's two languages. */
    readonly description: TriggerWords
    /** The payload of one event. */
    readonly payload: ReadonlyArray<TriggerField>
    /** How events are grouped into runs. */
    readonly batching: TriggerBatching
    /** How a missed event is recovered. */
    readonly recovery: TriggerRecovery
    /** The payload field whose value is the id of the record the run is about, with that record's kind (`bank-transaction`). */
    readonly subject?: { readonly kind: string; readonly field: string } | undefined
    /** True when one agent decides on the event (money, an answer to a customer) and every other one is only told. */
    readonly decided: boolean
    /**
     * True when the switch is ON for an account no person ever switched: the trigger only reports the completion of work NIVO itself
     * requested (a compose provider's `render.completed`, concept triggers rule 6a), so it opens no new inbound stream. A switch a person
     * set (on or off) wins over it. Absent: off until the owner turns it on.
     */
    readonly onByDefault?: boolean | undefined
}

/** One event a provider emits: its stable id at the provider, when it happened, and its payload. */
export interface ProviderEvent {
    /** The provider's own id of the event: what makes a repeat a no-op. */
    readonly id: string
    /** When it happened, when the provider says. */
    readonly occurredAt?: Date | null | undefined
    /** The payload, as the declaration types it. */
    readonly payload: Readonly<Record<string, unknown>>
}

/** An agent id, or null where there is none. */
export type OptionalAgentId = string | null

/** A trigger declaration, or null where the provider declares none of that name. */
export type OptionalTriggerDeclaration = ProviderTriggerDeclaration | null

/** The plain data a trigger's wake hands a run: the params, the trigger, the account and the agent's part. */
export interface WakeContext {
    /** One member of the plain data. */
    readonly [member: string]: unknown
}

/** What turning a switch asks. */
export interface SwitchRequest {
    /** On or off. */
    readonly enabled: boolean
    /** Turning on: start from where it last handed an event on (every event when it never did) instead of from now. */
    readonly catchUp?: boolean | undefined
}

/** The part an agent has in an event: it decides, or it is told. */
export type TriggerRole = "decider" | "notice"

/** The wake of one run a trigger starts, as the registration check and the tag door see it. */
export interface ProviderWake {
    /** `<provider>:<trigger>`. */
    readonly providerTrigger: string
    /** The account. */
    readonly connectionId: string
    /** The params the run reads: the payload fields (`each`) or `eventIds` and `count` (`list`). */
    readonly params: Readonly<Record<string, unknown>>
}

/** What the emit point asks the capability that owns the workflows. */
export interface ProviderTriggerReceivers {
    /** The agents attached to the account, in a stable order. */
    attachedTo(workspaceId: string, connectionId: string): Promise<ReadonlyArray<string>>
    /**
     * For each sample wake, whether an active workflow of the agent is registered on it and takes it (its filter holds), or a `wait` of
     * one lists its verb: the provider registry read's "which triggers this agent takes part in" (native-tools), no delivery.
     */
    registered(workspaceId: string, agentId: string, wakes: ReadonlyArray<ProviderWake>): Promise<ReadonlyArray<boolean>>
    /**
     * MATCH of the one event pipeline: the active workflow of the agent whose registration on `verb` takes an event with this generic
     * scope (`EventScope`), with the registration's own correlation key and settle time; null when none does.
     */
    takerOf(
        workspaceId: string,
        agentId: string,
        verb: TriggerVerb,
        scope: Readonly<Record<string, unknown>>,
        onlyWorkflowId?: string | null,
        /** A call's pin: only the registrations of the workflow of this key take it. */
        onlyWorkflowKey?: string | null,
    ): Promise<TriggerTaker | null>
    /**
     * Whether a `wait` step of an active workflow of the agent lists `verb`: then a run of it parked there may take an event no
     * registration of the agent takes (the waits come first: lane concept engine-core rule 8), so the event is delivered to it too.
     */
    waitsOn?(workspaceId: string, agentId: string, verb: TriggerVerb): Promise<boolean>
}

/** The registration that takes an event of the one event pipeline, as the delivery reads it. */
export interface TriggerTaker {
    /** The workflow whose registration takes it. */
    readonly workflowId: string
    /** The registration's own correlation key (a scope path), or null: then the declaration's key applies. */
    readonly ownKey: string | null
}

/** The inbox row an event was translated from: its declared account data type and its id. */
export interface DeliveredRaw {
    readonly type: string
    readonly id: string
}

/** One event handed to the delivery (ROAD-API section 1.2). */
export interface DeliveredEvent {
    /** What the source's `translate` gave. */
    readonly event: CanonicalEvent
    /** The inbox row it was translated from (an account event); absent for a source with no row. */
    readonly raw?: DeliveredRaw | undefined
    /** The files the entry kept in the shop's store for it: the run reads them as `trigger.data.files`. */
    readonly files?: ReadonlyArray<KeptFile> | undefined
    /** The person an engine source already knows (a timer armed in a run of a contact, a call's caller subject). */
    readonly contactId?: string | null | undefined
    /** The route an engine source already knows. */
    readonly routeId?: string | null | undefined
    /** The member behind it (a team chat line), else null. */
    readonly actorMemberId?: string | null | undefined
    /** When it happened, ISO 8601; an account event older than its switch's start point is dropped. */
    readonly occurredAt?: string | undefined
    /**
     * The one workflow whose registration an engine source fired for (the clock: the workflow of the `agent_triggers` row that fired), so
     * an agent with two registrations of the verb (two presets) is matched by the row, never by the verb alone. Absent: MATCH by verb.
     */
    readonly workflowId?: string | null | undefined
    /**
     * The hand-off pin of a workflow call (`workflowCall` of the tag context today: the callee's workflow and version), written on the
     * wake as the run side reads it (`tagContext`), so the run goes to that workflow (a pinned call, not a match).
     */
    readonly pin?: { readonly workflow: string; readonly version: number | "latest" } | null | undefined
    /**
     * The provenance of a workflow call made by a run (`core.call-workflow`): the calling agent and run. The engine's call guards (depth,
     * cycle, duplicate, open to) and the hand-off's right to speak (`handedOffBy`) read it from the wake. Null for a person's start.
     */
    readonly caller?: { readonly agentId: string | null; readonly runId: string | null } | null | undefined
}

/** What a source hands the ONE delivery function (`ProviderTriggersService.deliver`), in its entry's transaction. */
export interface DeliverInput {
    /** The workspace of the proven connection, or of the engine source. */
    readonly workspaceId: string
    /** The source's declaration: the registered object of its (source, name). */
    readonly declaration: TriggerDeclaration
    /** The account the events came through (a website form: the site); null for a source of the engine with no account. */
    readonly connectionId: string | null
    /** The one agent an engine source is about; null for an account event (every agent attached to the account is asked). */
    readonly agentId: string | null
    /** The events, in order. */
    readonly events: ReadonlyArray<DeliveredEvent>
}

/** What came of one delivery. */
export type DeliverResult =
    | { readonly status: "off" | "disconnected" }
    | {
          readonly status: "delivered"
          /** Events handed on. */
          readonly events: number
          /** Events left out: an id that is no id, data its schema refuses, older than the switch's start point. */
          readonly dropped: number
          /** One entry per wake written. */
          readonly woken: ReadonlyArray<{ readonly agentId: string; readonly workflowId: string; readonly eventId: string; readonly wakeId: string }>
          /** Wakes that existed already: the same event delivered twice. */
          readonly repeats: number
          /** Events no live registration took: kept raw by the entry, nothing woken. */
          readonly untaken: number
          /**
           * Events about a person whose route a member of the shop holds (ruling R45): kept (inbox, the person's line) but correlated to
           * nothing, no run and no wait woken; the hand-back's one resume event answers them.
           */
          readonly held: number
      }

/** The switch of one trigger on one account, as the interface reads it. */
export interface TriggerSwitchView {
    /** The trigger name. */
    readonly name: string
    /** Whether it is on. */
    readonly enabled: boolean
    /** Since when it is on, ISO 8601; events older than this are not handed on. Null when off. */
    readonly enabledAt: string | null
    /** When it last handed an event on, ISO 8601, or null. */
    readonly lastFiredAt: string | null
    /** How many events it handed on. */
    readonly firedCount: number
    /** The agent the owner bound as the decider, or null (then the provider's core agent decides, where one is bound). */
    readonly deciderAgentId: string | null
}

/** Why a change of a switch or of a decider was refused. */
export type TriggerChangeRefusal = "undeclared" | "unknown_account" | "not_decided" | "core_decides" | "not_attached"

/** What a change came to. */
export type TriggerChangeResult = { readonly ok: true } | { readonly ok: false; readonly reason: TriggerChangeRefusal }

/** One agent as the trigger card names it. */
export interface TriggerAgentCard {
    /** The agent. */
    readonly id: string
    /** Its name. */
    readonly name: string
}

/**
 * What the trigger card asks the capability that owns the agents: the cards of some agents of a workspace (only those it knows). Bound
 * by the app; with none bound every agent name reads null and no binding choice is offered.
 */
export interface ProviderTriggerAgentNames {
    /** The agents of the workspace among `agentIds`, each with its name. */
    cardsOf(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<ReadonlyArray<TriggerAgentCard>>
}

/** What the emit point's owner asks the providers: the agent a provider's own core path hands a trigger's events to. */
export interface ProviderTriggerCoreDeciders {
    /** The agent the core path hands the account's events of that trigger to, or null when it hands them to none. */
    coreDeciderOf(provider: string, trigger: string, connectionId: string): Promise<OptionalAgentId>
}

/**
 * What a provider's own core path reads of an account trigger: the agent the owner BOUND as its decider (the one column of the
 * account's switch row), whether the switch is on or off; null when nobody was bound or the owner never touched the trigger.
 */
export interface ProviderTriggerDeciderReader {
    /** The bound decider of the account's trigger, read on the caller's manager when it gives one. */
    boundDeciderOf(connectionId: string, trigger: string, manager?: EntityManager): Promise<OptionalAgentId>
}
