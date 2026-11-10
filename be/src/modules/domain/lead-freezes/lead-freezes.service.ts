import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezeStopHoldsService } from "./lead-freeze-stop-holds.service"
import { isThreadHold } from "./lead-freeze-threads.policy"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import {
    holds,
    holdsWorkflow,
    keysOf,
    leadSubjectOf,
    pendingEventOf,
    stateOf,
    subjectOfTrigger,
    transactionOf,
    withPending,
    workflowOfTrigger,
} from "./lead-freeze.policy"
import type {
    FreezeSubject,
    FreezeTrigger,
    FreezeWaiting,
    LeadFreeze,
    OptionalFreezeState,
    OptionalLeadFreeze,
} from "./lead-freezes.contracts"

/** What a trigger scope is to the freezes: plain members by name. */
type Trigger = FreezeTrigger

/**
 * Whether a freeze holds its customer: only the hold of a thread run's stop does. A freeze of the old engine left in the records is
 * history: it holds nobody, and nothing answers it any more.
 */
const isHolding = (freeze: OptionalLeadFreeze): freeze is LeadFreeze => holds(freeze) && isThreadHold(freeze)

@Injectable()
/**
 * The holds of customers whose thread run waits at a stop. While a stop of a run of the customer's workflow stands open, no new run of
 * THAT workflow starts for the customer: the start of every graph run asks `hold` first, and a wake of the held workflow is recorded as a
 * pending event instead (a line they wrote, a bank transaction, a timer, a hand-off). Every other workflow of the customer runs as usual.
 * The stop (its card, its answer box, its decisions) is the one thing that tells the founder; when it closes the customer is released
 * and the pending events are written again as wakes, in the order they came (`LeadFreezeStopHoldsService`).
 */
export class LeadFreezesService implements OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly gate: AgentGraphFreezeGateService,
        private readonly records: LeadFreezeRecordsService,
        private readonly stopHolds: LeadFreezeStopHoldsService,
    ) {}

    /** Registers with the gate of the graph flows once the app has started. */
    onModuleInit(): void {
        this.gate.set(this)
    }

    /**
     * True when the wake's customer is held: the wake is recorded for them and starts no run. A stop that closed since releases the
     * customer on the way, this event replayed with the others.
     */
    async hold(turn: AgentTurnView, trigger: Trigger): Promise<boolean> {
        const freeze = await this.holdingFor(turn.workspaceId, trigger)
        if (freeze === null) return this.holdForStop(turn, trigger)
        // The wake that opened the stopped thread run, tried again, continues its own run: it is never held by that run's stop.
        if (await this.stopHolds.isOwnRun(turn, freeze.frozenRunId)) return false
        const event = pendingEventOf(turn, trigger, this.clock.now().toISOString())
        const held = await this.records.patch(turn.workspaceId, freeze.id, (fresh) =>
            isHolding(fresh) ? { pending: withPending(fresh.pending, event) } : null,
        )
        if (held === null) return false
        this.logger.info(LeadFreezesLogEvent.EventHeld, {
            freezeId: held.id,
            wakeId: turn.wakeId,
            kind: event.kind,
            pending: held.pending.length,
        })
        await this.stopHolds.settle(turn.workspaceId, held)
        return true
    }

    /** The first hold of a customer: the wake waits as a pending event while a stop about its customer and workflow stands open. */
    private async holdForStop(turn: AgentTurnView, trigger: Trigger): Promise<boolean> {
        const subject = await this.subjectOf(turn.workspaceId, trigger)
        return subject !== null && this.stopHolds.holdFor(turn, trigger, subject)
    }

    /** Whether a lead waits for the founder, for the lead page; a hold whose stop closed is settled first. */
    async stateOfLead(workspaceId: string, leadId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byLead(workspaceId, leadId))
    }

    /** Whether the customer of a run waits for the founder because of it, for the run page. */
    async stateOfRun(workspaceId: string, runId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byRun(workspaceId, runId))
    }

    /** Whether a hold waits for the founder, by its id. */
    async stateOf(workspaceId: string, freezeId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byId(workspaceId, freezeId))
    }

    private async stateAfterSettle(workspaceId: string, freeze: OptionalLeadFreeze): Promise<OptionalFreezeState> {
        if (!isHolding(freeze)) return null
        if ((await this.stopHolds.settle(workspaceId, freeze)) === "on_stop") return stateOf(freeze)
        return stateOf(await this.records.byId(workspaceId, freeze.id))
    }

    /** True when the workflow a trigger names is held for its customer; nothing is recorded. */
    async frozen(workspaceId: string, trigger: Trigger): Promise<boolean> {
        if ((await this.holdingFor(workspaceId, trigger)) !== null) return true
        const subject = await this.subjectOf(workspaceId, trigger)
        return subject !== null && (await this.stopHolds.holding(workspaceId, trigger, subject, null)) !== null
    }

    /**
     * What waits for the founder for the customer of a trigger, whatever the workflow: the step each held workflow stopped on and
     * since when. The agents that still serve the customer read it, so they say no more than that the shop is checking.
     */
    async waitingOf(workspaceId: string, trigger: Trigger): Promise<ReadonlyArray<FreezeWaiting>> {
        const subject = await this.subjectOf(workspaceId, { ...trigger, workflowId: null })
        if (subject === null) return []
        const [holding, stops] = await Promise.all([
            this.records.holding(workspaceId),
            this.stopHolds.openAbout(workspaceId, subject),
        ])
        const held = holding.filter(
            (freeze) =>
                isThreadHold(freeze) &&
                (subject.leadId === null
                    ? freeze.conversationId !== null && freeze.conversationId === subject.conversationId
                    : freeze.leadId === subject.leadId),
        )
        // An open stop of a thread run waits for the founder too, before any wake of the customer was held for it.
        const recorded = new Set(held.map((freeze) => freeze.frozenRunId))
        const stopped = stops.filter((stop) => !recorded.has(stop.runId))
        return [
            ...held.map((freeze) => ({ step: freeze.stepTitle ?? freeze.stepKey ?? "", since: freeze.frozenAt ?? "" })),
            ...stopped.map((stop) => ({ step: stop.stepKey, since: stop.stoppedAt })),
        ]
    }

    /** The customer a trigger is about: its lead, else its conversation's lead, else the conversation; null when it names none. */
    private async subjectOf(workspaceId: string, trigger: Trigger): Promise<FreezeSubject | null> {
        const named = subjectOfTrigger(trigger)
        if (named?.leadId !== null || named.conversationId === null) return named
        const leadId = await this.records.leadOfConversation(workspaceId, named.conversationId)
        return leadId === null ? named : leadSubjectOf(leadId, named.conversationId, workflowOfTrigger(trigger))
    }

    /** The hold of the customer of a trigger: by its lead, its conversation, its conversation's lead or the order a transfer pays. */
    private async holdingFor(workspaceId: string, trigger: Trigger): Promise<LeadFreeze | null> {
        const named = (await Promise.all(keysOf(trigger).map((key) => this.records.byKey(workspaceId, key)))).find(
            isHolding,
        )
        if (named !== undefined) return named
        const subject = await this.subjectOf(workspaceId, trigger)
        if (subject !== null && !keysOf(trigger).includes(subject.key)) {
            const keys = [subject.key, ...(subject.leadId === null ? [] : [leadSubjectOf(subject.leadId, null).key])]
            const found = (await Promise.all(keys.map((key) => this.records.byKey(workspaceId, key)))).find(isHolding)
            if (found !== undefined) return found
        }
        const transactionId = transactionOf(trigger)
        if (transactionId === null) return null
        const workflowId = workflowOfTrigger(trigger)
        const holding = (await this.records.holding(workspaceId)).filter(
            (freeze) => isThreadHold(freeze) && holdsWorkflow(freeze, workflowId),
        )
        return holding.length === 0 ? null : this.records.leadOfTransaction(workspaceId, transactionId, holding)
    }
}
