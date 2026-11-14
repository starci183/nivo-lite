import { Injectable, Optional } from "@nestjs/common"
import { WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { EntityManager } from "typeorm"
import type { AgentWakeContext } from "@modules/domain/agent-work"
// The door file, not the barrel: the barrel reaches back to this capability through its readers (no import ring at decoration).
import { AgentWakeService } from "@modules/domain/agent-work/agent-wake.service"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
// The service file, not the barrel: the barrel loads contacts-page.service, which reaches agent-work while it is half loaded (R37).
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { CustomerMessagesService, CustomerRoutesService } from "@modules/domain/customer-routes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { canCatchUpOf } from "./provider-trigger-states.policy"
import { ProviderTriggerStoreService } from "./provider-trigger-store.service"
import type {
    DeliverInput,
    DeliverResult,
    DeliveredEvent,
    OptionalAgentId,
    ProviderTriggerCoreDeciders,
    ProviderTriggerDeclaration,
    ProviderTriggerReceivers,
    SwitchRequest,
    TriggerChangeResult,
    TriggerSwitchView,
} from "./provider-triggers.contracts"
import { InjectProviderTriggerCoreDeciders, InjectProviderTriggerReceivers } from "./provider-triggers.decorators"
import { ProviderTriggersLogEvent } from "./provider-triggers.log-events"
import { ProviderTriggersError, ProviderTriggersErrorCode } from "./errors/provider-triggers.error"
import type { DeclaredLine, TriggerDeclaration } from "./trigger-declaration.contracts"
import { triggerDeclarations } from "./trigger-declarations.registry"
import {
    TRIGGER_WAKE_SOURCE,
    eventIdHolds,
    eventScopeOf,
    eventWakeKeyOf,
    keyPathOf,
    keyValueOf,
    ownKeyPathOf,
    scopeKeyOfEvent,
    type EventScope,
} from "./trigger-delivery.policy"
import { declarationOf, onByDefaultOf, switchedOn, triggersOf } from "./provider-triggers.policy"

/** One event the delivery hands on, after its data passed its schema and its person was met. */
interface Handed {
    readonly given: DeliveredEvent
    readonly scope: EventScope
}

/** What one event came to for one agent. */
type EventOutcome =
    | { readonly kind: "woken"; readonly agentId: string; readonly workflowId: string; readonly eventId: string; readonly wakeId: string }
    | { readonly kind: "repeat" }
    | { readonly kind: "untaken" }
    /** No registration of the agent takes it, but a `wait` of one of its workflows lists the verb: a parked run of it may take it. */
    | { readonly kind: "listened" }
    /** The event is about a person whose route a member of the shop holds (ruling R45): kept, correlated to nothing. */
    | { readonly kind: "held" }

/** The member of a call's tag context that names the calling run (as `core.call-workflow` writes it; agent-graphs reads it). */
const CALLER_MEMBER = "caller"

/** The account switch facts of a declaration, or null for a trigger with no switch (a customer channel: on while its account is). */
const switchOf = (declaration: TriggerDeclaration) => declarationOf(declaration.provider, declaration.name)

const refused = (reason: Exclude<TriggerChangeResult, { ok: true }>["reason"]): TriggerChangeResult => ({ ok: false, reason })

@Injectable()
/**
 * THE ONE DELIVERY POINT of every trigger (`deliver`, lane concept triggers rule 13), and the switches of each account. Every source's
 * entry (a provider's webhook or poll after ITS signature check, the clock, a timer, the website form, the release door) hands its
 * canonical events to `deliver`; the old per-provider emit (`fire`, its decider / notice split and its dead hand-overs) is gone.
 */
export class ProviderTriggersService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly store: ProviderTriggerStoreService,
        private readonly connections: ConnectionBindingsReadService,
        @Optional() @InjectProviderTriggerReceivers() private readonly receivers: ProviderTriggerReceivers | null = null,
        @Optional()
        @InjectProviderTriggerCoreDeciders()
        private readonly coreDeciders: ProviderTriggerCoreDeciders | null = null,
        @Optional() private readonly contacts?: ContactsService,
        @Optional() private readonly routes?: CustomerRoutesService,
        @Optional() private readonly wakes?: AgentWakeService,
        @Optional() private readonly lines?: CustomerMessagesService,
    ) {}

    /**
     * THE ONE DELIVERY FUNCTION of the event pipeline (lane concept triggers rule 13; ROAD-API section 1.2), in the caller's transaction
     * (the entry's: its inbox row and the wakes commit together). The entry already kept the raw row once (stage 2, the account_data
     * intake) and ran its declaration's pure `translate` (stage 1). Here: the account's switch (a provider trigger that has one); ENRICH,
     * for an event about a person (its `subject`): the contact the channel's own id names, else a new one, and the person's route on the
     * account; MATCH: for each agent attached to the account (an engine source: the one agent it names), the active workflow whose
     * registration on the verb takes the event; CORRELATE: one wake per (agent, event) whose lock scope is the event's correlation key, so
     * the drain either starts a run or queues the event on the run of that key in flight. The same event delivered twice writes nothing
     * new (the wake's once-key). An event nobody takes wakes nothing (the entry keeps it raw, as before).
     */
    async deliver(input: DeliverInput, tx: EntityManager): Promise<DeliverResult> {
        const { declaration, workspaceId, connectionId } = input
        if (!triggerDeclarations.isRegistered(declaration)) {
            throw new ProviderTriggersError({
                code: ProviderTriggersErrorCode.DeclarationUnknown,
                params: { trigger: `${declaration.provider}:${declaration.name}` },
            })
        }
        const gate = await this.gateOf(input, tx)
        if (gate.status !== "open") return { status: gate.status }
        const handed: Array<Handed> = []
        await eachInOrder(input.events, async (given) => {
            const read = await this.scopeOf(input, given, gate.enabledAt)
            if (read === null) return
            handed.push({ given, scope: read.scope })
            // A person's message is kept on its route ONCE per event, before any agent is matched (R26): whether or not a wait or a
            // registration takes it, the conversation holds what the person said.
            await this.heard(input, given, read, tx)
        })
        const outcomes: Array<EventOutcome> = []
        const agents = await this.agentsOf(input)
        let accepted = 0
        await eachInOrder(handed, async (one) => {
            // A held route costs no AI work (R45): the event is kept (its raw row, the person's line above) and counted as delivered,
            // but no agent is matched and no wait is woken; the hand-back delivers the one resume event that answers it.
            if (await this.heldRoute(input, one, tx)) {
                outcomes.push({ kind: "held" })
                accepted += 1
                return
            }
            let taken = false
            let repeated = false
            await eachInOrder(agents, async (agentId) => {
                const outcome = await this.correlate(input, one, agentId, tx)
                if (outcome.kind !== "untaken") taken = true
                if (outcome.kind === "repeat") repeated = true
                if (outcome.kind !== "untaken") outcomes.push(outcome)
            })
            if (!taken) outcomes.push({ kind: "untaken" })
            // An event delivered again (its wake was written before) is no new firing.
            if (!repeated) accepted += 1
        })
        // The switch counts each accepted event once (not per registration, not a repeat): the Trigger tab's "last fired · N times" and
        // the start point of a `catchUp`. A switch with no row (its default) has nothing to count on, as before.
        if (gate.rowId !== null && accepted > 0) await this.store.markFired(tx, gate.rowId, this.clock.now(), accepted)
        const woken = outcomes.flatMap((outcome) =>
            outcome.kind === "woken"
                ? [{ agentId: outcome.agentId, workflowId: outcome.workflowId, eventId: outcome.eventId, wakeId: outcome.wakeId }]
                : [],
        )
        const result: DeliverResult = {
            status: "delivered",
            events: handed.length,
            dropped: input.events.length - handed.length,
            woken,
            repeats: outcomes.filter((outcome) => outcome.kind === "repeat").length,
            untaken: outcomes.filter((outcome) => outcome.kind === "untaken").length,
            held: outcomes.filter((outcome) => outcome.kind === "held").length,
        }
        this.logger.info(ProviderTriggersLogEvent.Delivered, {
            workspaceId,
            connectionId: connectionId ?? "",
            provider: declaration.provider,
            trigger: declaration.name,
            verb: declaration.verb,
            events: result.events,
            dropped: result.dropped,
            woken: woken.length,
            repeats: result.repeats,
            untaken: result.untaken,
            held: result.held,
        })
        return result
    }

    /**
     * True for an event ABOUT A PERSON (its `subject`: a channel identity) whose route a member of the shop holds now (the staff hold on
     * `customer_routes`, R43/R45). Generic: keyed on the route the engine met, nothing about chat. Any other event (no subject: a bank
     * credit, a timer, a call) flows as usual; so does every event in an app with no routes. The hold is read in the delivery's own
     * transaction: a hand-back that clears the hold and delivers its resume event in one transaction (R51 item 3) is not held by itself.
     */
    private async heldRoute(input: DeliverInput, one: Handed, tx: EntityManager): Promise<boolean> {
        const routeId = one.scope.routeId
        if (one.given.event.subject === undefined || routeId === undefined || this.routes === undefined) return false
        const hold = await this.routes.holdOf(input.workspaceId, routeId, tx)
        if (typeof hold?.memberId !== "string") return false
        this.logger.info(ProviderTriggersLogEvent.RouteHeld, {
            workspaceId: input.workspaceId,
            routeId,
            verb: input.declaration.verb,
            eventId: one.scope.eventId,
        })
        return true
    }

    /**
     * Whether the delivery may go on: an account of a provider must be the workspace's, of that provider and not disconnected; a provider
     * trigger with an account switch must be switched on (with its start point). A source of NIVO itself (`nivo`: the clock, a timer, the
     * website form, the team chat) has no connection to prove.
     */
    private async gateOf(
        input: DeliverInput,
        tx: EntityManager,
    ): Promise<
        { readonly status: "open"; readonly enabledAt: Date | null; readonly rowId: string | null } | { readonly status: "off" | "disconnected" }
    > {
        const { declaration, connectionId } = input
        if (connectionId === null || declaration.provider === PROVIDER.nivo) return { status: "open", enabledAt: null, rowId: null }
        const switchFacts = switchOf(declaration)
        const held = switchFacts === null ? null : await this.store.find(tx, connectionId, declaration.name)
        if (switchFacts !== null && (!switchedOn(held, switchFacts) || (held !== null && held.workspaceId !== input.workspaceId)))
            return { status: "off" }
        const account = await this.connections.recordOf(input.workspaceId, connectionId)
        if (account?.provider !== declaration.provider || account.status === "disconnected") return { status: "disconnected" }
        return { status: "open", enabledAt: held?.enabledAt ?? null, rowId: held?.id ?? null }
    }

    /**
     * The scope one event gives a graph, or null when it is left out: an id that is no id, data its declaration's schema refuses, or an
     * event older than its switch's start point. An event about a person is ENRICHED here: the contact the channel's own id of them names
     * (a new one, named as the channel shows them, when none does) and their route on the account, both made sure of.
     */
    private async scopeOf(
        input: DeliverInput,
        given: DeliveredEvent,
        enabledAt: Date | null,
    ): Promise<{ readonly scope: EventScope; readonly said: DeclaredLine | null } | null> {
        const { event } = given
        if (!eventIdHolds(event.id)) return null
        const at = given.occurredAt === undefined ? null : Date.parse(given.occurredAt)
        if (enabledAt !== null && at !== null && !Number.isNaN(at) && at < enabledAt.getTime()) return null
        const parsed = input.declaration.data.safeParse(event.data)
        if (!parsed.success) return null
        const data: Readonly<Record<string, unknown>> = { ...parsed.data }
        const person = await this.personOf(input, given)
        const scope = eventScopeOf({
            eventId: event.id,
            accountId: input.connectionId,
            contactId: person.contactId,
            routeId: person.routeId,
            data,
            files: given.files ?? [],
        })
        // The source's pure reading of the event as a person's message, on the PARSED data (null: this event is none).
        return { scope, said: input.declaration.line?.(parsed.data) ?? null }
    }

    /**
     * Keeps a person's message on its route (`CustomerMessagesService.hear`, insert-or-nothing per route and the source's key): an event
     * about a channel identity (`subject`) whose declaration reads a line from it. The same event delivered twice keeps one line.
     */
    private async heard(
        input: DeliverInput,
        given: DeliveredEvent,
        read: { readonly scope: EventScope; readonly said: DeclaredLine | null },
        tx: EntityManager,
    ): Promise<void> {
        const { subject } = given.event
        const { said, scope } = read
        if (this.lines === undefined || subject === undefined || said === null || said.key === "") return
        if (scope.routeId === undefined || scope.contactId === undefined) return
        await this.lines.hear(tx, {
            workspaceId: input.workspaceId,
            routeId: scope.routeId,
            contactId: scope.contactId,
            channel: subject.channel,
            accountId: input.connectionId,
            key: said.key,
            text: said.text,
            at: said.at ?? given.occurredAt ?? null,
            files: given.files ?? [],
            eventId: given.event.id,
        })
    }

    /** ENRICH: the person of an event with a subject (met, and their route ensured), else the one an engine source names. */
    private async personOf(
        input: DeliverInput,
        given: DeliveredEvent,
    ): Promise<{ readonly contactId: string | null; readonly routeId: string | null }> {
        const { subject } = given.event
        const { connectionId, workspaceId } = input
        if (subject === undefined || connectionId === null || this.contacts === undefined || this.routes === undefined)
            return { contactId: given.contactId ?? null, routeId: given.routeId ?? null }
        const contactId = await this.contacts.meetChannel(workspaceId, {
            channel: subject.channel,
            account: connectionId,
            userId: subject.id,
            name: subject.name ?? null,
        })
        const { routeId } = await this.routes.ensure(workspaceId, { contactId, channel: subject.channel, accountId: connectionId })
        return { contactId, routeId }
    }

    /** The agents MATCH asks: the one an engine source names, else every agent attached to the account, each once. */
    private async agentsOf(input: DeliverInput): Promise<ReadonlyArray<string>> {
        if (input.agentId !== null) return [input.agentId]
        if (input.connectionId === null || this.receivers === null) return []
        return [...new Set(await this.receivers.attachedTo(input.workspaceId, input.connectionId))]
    }

    /**
     * MATCH and CORRELATE of one event for one agent: the workflow whose registration takes it, then one wake keyed once by the verb, the
     * origin and the event's id, locked by the event's correlation key (the registration's own, else the declaration's), with the
     * registration's settle time. Ids only ride on the wake: the data is rebuilt from the raw row when the run starts.
     */
    private async correlate(input: DeliverInput, one: Handed, agentId: string, tx: EntityManager): Promise<EventOutcome> {
        const { declaration } = input
        const pin = one.given.pin ?? null
        const taker = await this.receivers?.takerOf(
            input.workspaceId,
            agentId,
            declaration.verb,
            { ...one.scope },
            one.given.workflowId ?? null,
            pin?.workflow ?? null,
        )
        if (this.wakes === undefined) return { kind: "untaken" }
        // No registration takes it: the agent still hears it when a `wait` of one of its workflows lists the verb (a run parked there may
        // take it; with none the drain ends it `no_waiter`). The clock's firing names its workflow, so it is never heard by a wait.
        const listened =
            (taker === null || taker === undefined) &&
            (one.given.workflowId ?? null) === null &&
            pin === null &&
            (await this.receivers?.waitsOn?.(input.workspaceId, agentId, declaration.verb)) === true
        if ((taker === null || taker === undefined) && !listened) return { kind: "untaken" }
        const keyPath = ownKeyPathOf(taker?.ownKey ?? null) ?? keyPathOf(declaration.key)
        const keyValue = keyPath === null ? null : keyValueOf(one.scope, keyPath)
        const origin = input.connectionId ?? agentId
        const written = await this.wakes.write(tx, {
            workspaceId: input.workspaceId,
            agentId,
            source: TRIGGER_WAKE_SOURCE,
            eventKey: eventWakeKeyOf(declaration.verb, origin, one.scope.eventId),
            context: this.contextOf(input, one, taker?.workflowId ?? null, keyValue === null ? null : keyPath),
            actorMemberId: one.given.actorMemberId ?? null,
            scopeKey: scopeKeyOfEvent(keyPath, keyValue),
            // The settle time is the SOURCE's (its declaration: a chat line a few seconds, capped; every other source zero).
            ...(declaration.settle === undefined || declaration.settle === null ? {} : { settle: declaration.settle }),
        })
        if (written === null) return { kind: "repeat" }
        return taker === null || taker === undefined
            ? { kind: "listened" }
            : { kind: "woken", agentId, workflowId: taker.workflowId, eventId: one.scope.eventId, wakeId: written }
    }

    /**
     * The ids a wake of the pipeline carries (ROAD-API section 3.2): the verb, the event, the declaration, the workflow that took it, the
     * key it is locked by, the account, the person and the route (`conversationId`: the engine's own name of the route, which holds, stops
     * and freezes are keyed by), the raw row its data is rebuilt from, else the data itself for a source that keeps no row, and the files.
     */
    private contextOf(input: DeliverInput, one: Handed, workflowId: string | null, keyPath: string | null): AgentWakeContext {
        const { declaration, connectionId } = input
        const { scope, given } = one
        return {
            verb: declaration.verb,
            eventId: scope.eventId,
            declaration: `${declaration.provider}:${declaration.name}`,
            // A wake no registration took names no workflow: only a parked `wait` may take it (`listened`).
            ...(workflowId === null ? { waitOnly: "true" as const } : { workflowId }),
            ...(keyPath === null ? {} : { keyPath }),
            ...(connectionId === null ? {} : { connectionId }),
            ...(scope.contactId === undefined ? {} : { contactId: scope.contactId }),
            ...(scope.routeId === undefined ? {} : { conversationId: scope.routeId }),
            ...(given.raw === undefined
                ? { dataJson: JSON.stringify(given.event.data) }
                : { rawType: given.raw.type, rawRowId: given.raw.id }),
            ...(given.files === undefined || given.files.length === 0 ? {} : { filesJson: JSON.stringify(given.files) }),
            ...this.callContextOf(given),
        }
    }

    /**
     * What a workflow call's wake carries beside its ids (the pin routes it; the engine's call guards and the hand-off's right to speak
     * read the rest): `tagContext = { workflowCall, params, caller? }` in the shape `core.call-workflow` always wrote, and the calling
     * agent as `authorAgentId`. Nothing for an event that is no call.
     */
    private callContextOf(given: DeliveredEvent): Pick<AgentWakeContext, "tagContext" | "authorAgentId"> {
        const pin = given.pin ?? null
        if (pin === null) return {}
        const caller = given.caller ?? null
        const tagContext = JSON.stringify({
            [WORKFLOW_CALL_MEMBER]: pin,
            [WORKFLOW_PARAMS_MEMBER]: given.event.data,
            ...(caller?.runId == null ? {} : { [CALLER_MEMBER]: { runId: caller.runId } }),
        })
        return { tagContext, ...(caller?.agentId == null ? {} : { authorAgentId: caller.agentId }) }
    }

    /**
     * Whether the account's switch of the trigger is on: the one read a provider makes before any work of its own for the trigger. With no
     * switch set, the trigger's default (`onByDefault`, the same for every provider that declares the name).
     */
    async isOn(connectionId: string, trigger: string, manager: EntityManager = this.entityManager): Promise<boolean> {
        const held = await this.store.find(manager, connectionId, trigger)
        return held === null ? onByDefaultOf(trigger) : held.enabled === true
    }

    /** The switches of one account: one per trigger its provider declares; where the owner never touched one, its default (off but rule 6a). */
    async switchesOf(workspaceId: string, connectionId: string): Promise<ReadonlyArray<TriggerSwitchView>> {
        const account = await this.connections.recordOf(workspaceId, connectionId)
        if (account === null) return []
        const held = new Map((await this.store.listOf(workspaceId, connectionId)).map((row) => [row.triggerName, row]))
        return triggersOf(account.provider).map((declaration) => {
            const row = held.get(declaration.name)
            return {
                name: declaration.name,
                enabled: switchedOn(row, declaration),
                enabledAt: row?.enabled === true ? (row.enabledAt?.toISOString() ?? null) : null,
                lastFiredAt: row?.lastFiredAt?.toISOString() ?? null,
                firedCount: row?.firedCount ?? 0,
                deciderAgentId: row?.deciderAgentId ?? null,
            }
        })
    }

    /**
     * Turns the trigger of an account on or off (the caller proved the person may). Turning it on sets the start point: now, or with
     * `catchUp` the moment it last handed an event on (every event when it never did), so what the provider's recovery brings back
     * from the time it was off is taken. A trigger whose provider recovers no missed event cannot catch up: it starts from now.
     */
    async setEnabled(
        workspaceId: string,
        connectionId: string,
        trigger: string,
        change: SwitchRequest,
    ): Promise<TriggerChangeResult> {
        const declaration = await this.declaredOn(workspaceId, connectionId, trigger)
        if (typeof declaration === "string") return refused(declaration)
        if (!change.enabled) {
            await this.store.change(workspaceId, connectionId, trigger, { enabled: false })
            return { ok: true }
        }
        const held = await this.store.find(this.entityManager, connectionId, trigger)
        const catchUp = change.catchUp === true && canCatchUpOf(declaration)
        const enabledAt = catchUp ? (held?.lastFiredAt ?? null) : this.clock.now()
        await this.store.change(workspaceId, connectionId, trigger, { enabled: true, enabledAt })
        return { ok: true }
    }

    /**
     * Binds the agent that decides on an account's trigger, or unbinds it with null (the caller proved the person may). Refused for a
     * trigger nobody decides on, for an agent that is not attached to the account, and while the provider's own core path hands the
     * account's events to an agent: that agent decides until its binding is removed, so one account trigger never has two deciders.
     */
    async bindDecider(
        workspaceId: string,
        connectionId: string,
        trigger: string,
        agentId: OptionalAgentId,
    ): Promise<TriggerChangeResult> {
        const declaration = await this.declaredOn(workspaceId, connectionId, trigger)
        if (typeof declaration === "string") return refused(declaration)
        if (!declaration.decided) return refused("not_decided")
        if (agentId !== null) {
            const core = await this.coreDeciders?.coreDeciderOf(declaration.provider, trigger, connectionId)
            if (core != null) return refused("core_decides")
            const attached = (await this.receivers?.attachedTo(workspaceId, connectionId)) ?? []
            if (!attached.includes(agentId)) return refused("not_attached")
        }
        await this.store.change(workspaceId, connectionId, trigger, { deciderAgentId: agentId })
        return { ok: true }
    }

    /** The declaration of a trigger on an account of the workspace, or why there is none. */
    private async declaredOn(
        workspaceId: string,
        connectionId: string,
        trigger: string,
    ): Promise<ProviderTriggerDeclaration | "unknown_account" | "undeclared"> {
        const account = await this.connections.recordOf(workspaceId, connectionId)
        if (account === null) return "unknown_account"
        return declarationOf(account.provider, trigger) ?? "undeclared"
    }
}
