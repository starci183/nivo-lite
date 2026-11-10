import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { LeadFreezeItemsService } from "./lead-freeze-items.service"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezeRunsService } from "./lead-freeze-runs.service"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"
import {
    THREAD_RELEASER,
    isRunClosed,
    isThreadHold,
    oldestStopOf,
    stopHoldsWorkflow,
    stopIsAbout,
    stopSubjectOf,
    threadHoldOf,
} from "./lead-freeze-threads.policy"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import {
    foldLines,
    holds,
    holdsWorkflow,
    isJsonObject,
    keysOf,
    leadSubjectOf,
    linesToFold,
    pendingEventOf,
    replayOf,
    stateOf,
    subjectOfTrigger,
    transactionOf,
    withPending,
    workflowOfTrigger,
} from "./lead-freeze.policy"
import type {
    FreezeLocale,
    FreezeOutcome,
    FreezeReleaseReason,
    FreezeStop,
    FreezeSubject,
    FreezeTrigger,
    FreezeValues,
    FreezeWaiting,
    HeldStop,
    LeadFreeze,
    OptionalFreezeState,
    OptionalLeadFreeze,
    StoppedRun,
} from "./lead-freezes.contracts"

/** What a trigger scope is to the freezes: plain members by name. */
type Trigger = FreezeTrigger

/** Where a run stands when it ended well. */
const DONE = "done"

/** Where a run stands when it stopped and a person must act: a retry that ends here failed again. */
const STOPPED: ReadonlySet<string> = new Set(["parked", "dead", "failed", "compensated", "cancelled"])

/** The values of a freeze that starts a new episode: no event yet, nobody holding the conversation, nothing released. */
const freshEpisode = (freeze: LeadFreeze, run: StoppedRun, at: string): FreezeValues => ({
    status: "frozen",
    frozenRunId: run.runId,
    agentId: run.agentId,
    frozenAt: at,
    episode: freeze.episode + 1,
    failures: 1,
    pending: [],
    heldBy: null,
    workItemId: null,
    releasedAt: null,
    releasedBy: null,
    releaseReason: null,
})

@Injectable()
/**
 * The freeze of ONE workflow of a customer whose run stopped for good (parked for the founder or dead, never a retry that may still
 * cure it). While it is frozen no new run of THAT workflow starts for the customer: the start of every graph run asks `hold` first, and
 * a wake of the frozen workflow is recorded as a pending event instead (a line they wrote, a bank transaction, a timer, a hand-off).
 * Every other workflow of the customer runs as usual, so their other messages are still served. The engine sends them nothing more; the failing run's
 * own holding line is the only one. The owner has one item per frozen customer: "Retry" runs the failed run again from its failed step
 * with the lines the customer wrote since, "Take over" hands the conversation to a person, "Skip this turn" gives the run up. Only a
 * retry that ends well, or a skip, releases the customer; then the pending events are written again as wakes, in the order they came.
 */
export class LeadFreezesService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly gate: AgentGraphFreezeGateService,
        private readonly records: LeadFreezeRecordsService,
        private readonly items: LeadFreezeItemsService,
        private readonly runs: LeadFreezeRunsService,
        private readonly wakes: LeadFreezeWakesService,
        @Optional() private readonly handlers?: AgentRunHandlersService,
        /** The stops of thread runs; absent (a world with no threads), no stop holds anyone and only the old freezes hold. */
        @Optional() private readonly stops?: LeadFreezeStopsService,
    ) {}

    /** Registers with the gate of the graph flows once the app has started. */
    onModuleInit(): void {
        this.gate.set(this)
        this.handlers?.onEnded((workspaceId, runId) => this.runEnded(workspaceId, runId))
    }

    /**
     * True when the wake's customer is frozen: the wake is recorded for them and starts no run. A freeze whose retry runs is settled on
     * the way, so a retry that already ended well releases the customer and replays this event with the others.
     */
    async hold(turn: AgentTurnView, trigger: Trigger): Promise<boolean> {
        const freeze = await this.holdingFor(turn.workspaceId, trigger)
        if (freeze === null) return this.holdForStop(turn, trigger)
        // The wake that opened the stopped thread run, tried again, continues its own run: it is never held by that run's stop.
        if (isThreadHold(freeze) && (await this.ownRunOf(turn)) === freeze.frozenRunId) return false
        const event = pendingEventOf(turn, trigger, this.clock.now().toISOString())
        const held = await this.records.patch(turn.workspaceId, freeze.id, (fresh) =>
            holds(fresh) ? { pending: withPending(fresh.pending, event) } : null,
        )
        if (held === null) return false
        this.logger.info(LeadFreezesLogEvent.EventHeld, {
            freezeId: held.id,
            wakeId: turn.wakeId,
            kind: event.kind,
            pending: held.pending.length,
        })
        // A stop that closed since releases the customer now, this event with the others, in the order they came.
        if (isThreadHold(held)) await this.settleThread(turn.workspaceId, held)
        else if (held.status === "retrying") await this.settle(turn.workspaceId, held, "retry")
        return true
    }

    /**
     * The hold of a thread run's stop (`engine = langgraph`): while a stop of a run of the customer's workflow stands open, the wake starts
     * no new run and is recorded as a pending event on the freeze that points at that run and step. No owner item is raised: the stop's
     * card is the one thing that tells the founder. False when no open stop is about the customer in this workflow.
     */
    private async holdForStop(turn: AgentTurnView, trigger: Trigger): Promise<boolean> {
        const subject = await this.subjectOf(turn.workspaceId, trigger)
        if (subject === null) return false
        const stop = await this.stopHolding(turn.workspaceId, trigger, subject, await this.ownRunOf(turn))
        if (stop === null) return false
        const at = this.clock.now().toISOString()
        const event = pendingEventOf(turn, trigger, at)
        const keyed = stopSubjectOf(subject, stop)
        const name = keyed.leadId === null ? null : await this.records.nameOfLead(turn.workspaceId, keyed.leadId)
        const record = await this.records.ensure(turn.workspaceId, keyed, { status: "released", pending: [] })
        const held = await this.records.patch(turn.workspaceId, record.id, (fresh) =>
            holds(fresh)
                ? { pending: withPending(fresh.pending, event) }
                : {
                      ...threadHoldOf(fresh, stop, at),
                      ...(name === null ? {} : { customerName: name }),
                      ...(keyed.conversationId === null ? {} : { conversationId: keyed.conversationId }),
                      pending: [event],
                  },
        )
        if (held === null) return false
        this.logger.info(LeadFreezesLogEvent.HeldForStop, {
            freezeId: held.id,
            runId: stop.runId,
            stepKey: stop.stepKey,
            wakeId: turn.wakeId,
            kind: event.kind,
            pending: held.pending.length,
        })
        return true
    }

    /**
     * The oldest open stop that holds a wake of the trigger's workflow for the customer, of a run that is not over and is not the wake's
     * own run; null when none does.
     */
    private async stopHolding(
        workspaceId: string,
        trigger: Trigger,
        subject: FreezeSubject,
        ownRunId: string | null,
    ): Promise<HeldStop | null> {
        const workflowId = workflowOfTrigger(trigger)
        const open = (await this.openStopsOf(workspaceId, subject)).filter(
            (stop) => stop.runId !== ownRunId && stopIsAbout(stop, subject) && stopHoldsWorkflow(stop, workflowId),
        )
        if (open.length === 0) return null
        const statuses = await Promise.all(open.map((stop) => this.runs.statusOf(workspaceId, stop.runId)))
        return oldestStopOf(open.filter((_, at) => !isRunClosed(statuses[at] ?? null)))
    }

    /** The open stops of thread runs about the customer; none in a world with no threads. */
    private async openStopsOf(workspaceId: string, subject: FreezeSubject): Promise<ReadonlyArray<HeldStop>> {
        return (await this.stops?.openOfCustomer(workspaceId, subject)) ?? []
    }

    /** The run a wake tried again already opened, or null (a wake on its first try opened none). */
    private async ownRunOf(turn: AgentTurnView): Promise<string | null> {
        return turn.attempts > 1 ? this.runs.runOfWake(turn.workspaceId, turn.wakeId) : null
    }

    /**
     * Where the hold of a thread run's stop stands: still held while a stop of its run stands open (the freeze follows the step that
     * stopped last), released with every pending event replayed once, in order, when none does (the step completed after an answer,
     * the founder skipped, a deadline moved it, or the run is over).
     */
    private async settleThread(workspaceId: string, freeze: LeadFreeze): Promise<FreezeOutcome> {
        if (!holds(freeze)) return "released"
        const open = freeze.frozenRunId === null ? null : await this.openStopOfRun(workspaceId, freeze.frozenRunId)
        if (open !== null) {
            if (open.stepKey !== freeze.stepKey)
                await this.records.patch(workspaceId, freeze.id, (fresh) =>
                    holds(fresh) && fresh.stepKey !== open.stepKey ? { stepKey: open.stepKey } : null,
                )
            return "on_stop"
        }
        await this.release(workspaceId, freeze, "stop_closed", THREAD_RELEASER)
        return "released"
    }

    /** The open stop of a run that is not over, or null. */
    private async openStopOfRun(workspaceId: string, runId: string): Promise<HeldStop | null> {
        if (isRunClosed(await this.runs.statusOf(workspaceId, runId))) return null
        return oldestStopOf((await this.stops?.openOfRun(workspaceId, runId)) ?? [])
    }

    /**
     * After a drive of a thread run (it stopped, waits or ended): when the run holds a customer for its stop and no stop of it stands
     * open any more, the customer is released and their pending events replayed now, once, in order, instead of on their next wake. A
     * failure is logged and left to the next wake of the customer or the next sweep; it never fails the drive.
     */
    async threadSettled(workspaceId: string, runId: string): Promise<void> {
        try {
            const freeze = await this.records.byRun(workspaceId, runId)
            if (!holds(freeze) || !isThreadHold(freeze)) return
            await this.settleThread(workspaceId, freeze)
        } catch (cause) {
            this.logger.error(LeadFreezesLogEvent.SettleFailed, cause, { runId })
        }
    }

    /** Settles every hold of a thread run's stop in the workspace (the sweep's backstop); answers how many it released. */
    async settleThreads(workspaceId: string): Promise<number> {
        const threadHolds = (await this.records.holding(workspaceId)).filter(isThreadHold)
        let released = 0
        await eachInOrder(threadHolds, async (freeze) => {
            if ((await this.settleThread(workspaceId, freeze)) === "released") released += 1
        })
        return released
    }

    /**
     * Freezes the customer of a run that stopped for good, once per run: a new episode with its owner item, or, for the run of the freeze,
     * the item updated with the newest failure. The run is taken off the machine's resume passes. True when the run froze its customer,
     * so the caller raises no review of its own; false for a run that is not a graph run or names no customer.
     */
    async stopped(stop: FreezeStop): Promise<boolean> {
        const run = await this.runs.stoppedOf(stop.workspaceId, stop.runId)
        if (run?.failed?.nodeStep !== true) return false
        const scope = stop.trigger ?? triggerOfInput(run.failed.input) ?? run.context
        // The freeze is the workflow's: the one the stopped run is pinned to.
        const trigger = { ...scope, workflowId: workflowOfInput(run.failed.input) }
        const subject = await this.subjectOf(stop.workspaceId, trigger)
        if (subject === null) return false
        const frozen = await this.freeze(stop, run, subject)
        if (frozen === null) return false
        await this.runs.keep(stop.workspaceId, run.runId)
        await this.raise(stop.workspaceId, frozen, run.locale)
        return true
    }

    /**
     * "Retry": runs the failed run again from its failed step with the lines the customer wrote while frozen, and drives it in place.
     * A run that ends well releases the customer and replays the pending events; one that fails again keeps them frozen and updates the
     * item; one that runs on (a wait) releases them when it ends well.
     */
    async retry(workspaceId: string, freezeId: string, actor: string): Promise<FreezeOutcome> {
        const freeze = await this.records.byId(workspaceId, freezeId)
        if (!holds(freeze) || freeze.frozenRunId === null) return "not_frozen"
        if (isThreadHold(freeze)) return this.settleThread(workspaceId, freeze)
        if ((await this.runs.statusOf(workspaceId, freeze.frozenRunId)) === DONE) {
            await this.release(workspaceId, freeze, "retried", actor)
            return "released"
        }
        // The customer's lines are shown to the failed turn only when its failed step reads their words; else they wait to be replayed.
        const folds = await this.runs.readsCustomerWords(workspaceId, freeze.frozenRunId)
        const started = await this.records.patch(workspaceId, freeze.id, (fresh) =>
            fresh.status === "frozen"
                ? { status: "retrying", pending: folds ? foldLines(fresh.pending, fresh.conversationId) : fresh.pending }
                : null,
        )
        if (started === null) return "retrying"
        this.logger.info(LeadFreezesLogEvent.RetryStarted, { freezeId, runId: freeze.frozenRunId })
        const fold = folds ? linesToFold(started.pending, started.conversationId) : []
        const { resume } = await this.runs.retry(workspaceId, freeze.frozenRunId, actor, fold)
        const after = (await this.records.byId(workspaceId, freeze.id)) ?? started
        if (resume.kind === "resumed") return this.settle(workspaceId, after, actor)
        const outcome = await this.settle(workspaceId, after, actor)
        return resume.kind === "outcome_unknown" && outcome === "still_frozen" ? "not_retryable" : outcome
    }

    /** "Skip this turn": gives the failed run up for good, releases the customer and replays the pending events, every one of them. */
    async skip(workspaceId: string, freezeId: string, actor: string): Promise<FreezeOutcome> {
        const freeze = await this.records.byId(workspaceId, freezeId)
        if (!holds(freeze)) return "not_frozen"
        if (isThreadHold(freeze)) return this.settleThread(workspaceId, freeze)
        if (freeze.frozenRunId !== null) await this.runs.abandon(workspaceId, freeze.frozenRunId, actor)
        await this.release(workspaceId, freeze, "skipped", actor)
        return "skipped"
    }

    /** "Take over": a person holds the conversation and answers the customer; the customer stays frozen, the AI sends nothing. */
    async takeOver(workspaceId: string, freezeId: string, holder: string): Promise<FreezeOutcome> {
        const freeze = await this.records.byId(workspaceId, freezeId)
        if (!holds(freeze)) return "not_frozen"
        if (isThreadHold(freeze)) return this.settleThread(workspaceId, freeze)
        if (freeze.conversationId !== null) await this.wakes.takeOver(workspaceId, freeze.conversationId, holder)
        await this.records.patch(workspaceId, freeze.id, (fresh) => (holds(fresh) ? { heldBy: holder } : null))
        this.logger.info(LeadFreezesLogEvent.TakenOver, { freezeId })
        return "taken_over"
    }

    /** Opens the next item of a freeze that still holds its customer when the one it names was decided; a waiting one is updated. */
    async reraise(workspaceId: string, freezeId: string): Promise<void> {
        const freeze = await this.records.byId(workspaceId, freezeId)
        if (!holds(freeze) || freeze.frozenRunId === null || isThreadHold(freeze)) return
        const run = await this.runs.stoppedOf(workspaceId, freeze.frozenRunId)
        await this.raise(workspaceId, freeze, run?.locale ?? "vi")
    }

    /**
     * A run the job drove ended `done`: when it is the run of a freeze whose retry outlived the owner's answer (the door answered
     * `retrying` and the job carried the rest), the freeze is released now and its pending events replayed, once. Not waiting for the
     * customer's next message keeps that message from being held first and replayed after. A failure is logged and left to the lazy
     * settle on the next read; it never fails the run.
     */
    async runEnded(workspaceId: string, runId: string): Promise<void> {
        try {
            const freeze = await this.records.byRun(workspaceId, runId)
            if (!holds(freeze) || freeze.status !== "retrying" || freeze.frozenRunId !== runId) return
            await this.settle(workspaceId, freeze, "retry")
        } catch (cause) {
            this.logger.error(LeadFreezesLogEvent.SettleFailed, cause, { runId })
        }
    }

    /** Whether a lead waits for the owner, for the lead page; a retry that already ended is settled first. */
    async stateOfLead(workspaceId: string, leadId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byLead(workspaceId, leadId))
    }

    /** Whether the customer of a run waits for the owner because of it, for the run page. */
    async stateOfRun(workspaceId: string, runId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byRun(workspaceId, runId))
    }

    /** Whether a freeze waits for the owner, by its id. */
    async stateOf(workspaceId: string, freezeId: string): Promise<OptionalFreezeState> {
        return this.stateAfterSettle(workspaceId, await this.records.byId(workspaceId, freezeId))
    }

    private async stateAfterSettle(workspaceId: string, freeze: OptionalLeadFreeze): Promise<OptionalFreezeState> {
        if (holds(freeze) && isThreadHold(freeze)) {
            if ((await this.settleThread(workspaceId, freeze)) === "on_stop") return stateOf(freeze)
            return stateOf(await this.records.byId(workspaceId, freeze.id))
        }
        if (!holds(freeze) || freeze.status !== "retrying") return stateOf(freeze)
        await this.settle(workspaceId, freeze, "retry")
        return stateOf(await this.records.byId(workspaceId, freeze.id))
    }

    /** The customer a trigger is about: its lead, else its conversation's lead, else the conversation; null when it names none. */
    private async subjectOf(workspaceId: string, trigger: Trigger): Promise<FreezeSubject | null> {
        const named = subjectOfTrigger(trigger)
        if (named?.leadId !== null || named.conversationId === null) return named
        const leadId = await this.records.leadOfConversation(workspaceId, named.conversationId)
        return leadId === null ? named : leadSubjectOf(leadId, named.conversationId, workflowOfTrigger(trigger))
    }

    /** True when the workflow a trigger names is frozen for its customer; nothing is recorded. */
    async frozen(workspaceId: string, trigger: Trigger): Promise<boolean> {
        if ((await this.holdingFor(workspaceId, trigger)) !== null) return true
        const subject = await this.subjectOf(workspaceId, trigger)
        return subject !== null && (await this.stopHolding(workspaceId, trigger, subject, null)) !== null
    }

    /**
     * What waits for the founder for the customer of a trigger, whatever the workflow: the step each frozen workflow stopped on and
     * since when. The agents that still serve the customer read it, so they say no more than that the shop is checking.
     */
    async waitingOf(workspaceId: string, trigger: Trigger): Promise<ReadonlyArray<FreezeWaiting>> {
        const subject = await this.subjectOf(workspaceId, { ...trigger, workflowId: null })
        if (subject === null) return []
        const [holding, stops] = await Promise.all([
            this.records.holding(workspaceId),
            this.openStopsOf(workspaceId, subject),
        ])
        const frozen = holding.filter((freeze) =>
            subject.leadId === null
                ? freeze.conversationId !== null && freeze.conversationId === subject.conversationId
                : freeze.leadId === subject.leadId,
        )
        // An open stop of a thread run waits for the founder too, before any wake of the customer was held for it.
        const recorded = new Set(frozen.map((freeze) => freeze.frozenRunId))
        const stopped = stops.filter((stop) => stopIsAbout(stop, subject) && !recorded.has(stop.runId))
        return [
            ...frozen.map((freeze) => ({ step: freeze.stepTitle ?? freeze.stepKey ?? "", since: freeze.frozenAt ?? "" })),
            ...stopped.map((stop) => ({ step: stop.stepKey, since: stop.stoppedAt })),
        ]
    }

    /** The freeze that holds the customer of a trigger: by its lead, its conversation, its conversation's lead or the order a transfer pays. */
    private async holdingFor(workspaceId: string, trigger: Trigger): Promise<LeadFreeze | null> {
        const named = (await Promise.all(keysOf(trigger).map((key) => this.records.byKey(workspaceId, key)))).find(
            holds,
        )
        if (named !== undefined) return named
        const subject = await this.subjectOf(workspaceId, trigger)
        if (subject !== null && !keysOf(trigger).includes(subject.key)) {
            const keys = [subject.key, ...(subject.leadId === null ? [] : [leadSubjectOf(subject.leadId, null).key])]
            const found = (await Promise.all(keys.map((key) => this.records.byKey(workspaceId, key)))).find(holds)
            if (found !== undefined) return found
        }
        const transactionId = transactionOf(trigger)
        if (transactionId === null) return null
        const workflowId = workflowOfTrigger(trigger)
        const holding = (await this.records.holding(workspaceId)).filter((freeze) => holdsWorkflow(freeze, workflowId))
        return holding.length === 0 ? null : this.records.leadOfTransaction(workspaceId, transactionId, holding)
    }

    /**
     * Writes the freeze of a stopped run: a new episode when the customer is not frozen, the newest failure when the run of the freeze
     * failed again after a retry, and nothing for a run told twice. A run of a customer already frozen by another run is only held.
     */
    private async freeze(stop: FreezeStop, run: StoppedRun, subject: FreezeSubject): Promise<LeadFreeze | null> {
        const at = this.clock.now().toISOString()
        const [title, name] = await Promise.all([
            this.runs.stepTitleOf(stop.workspaceId, run),
            subject.leadId === null ? Promise.resolve(null) : this.records.nameOfLead(stop.workspaceId, subject.leadId),
        ])
        const facts: FreezeValues = {
            frozenReason: stop.code,
            stepKey: run.failed?.stepKey ?? stop.stepKey,
            stepTitle: title,
            ...(name === null ? {} : { customerName: name }),
            ...(subject.conversationId === null ? {} : { conversationId: subject.conversationId }),
        }
        const record = await this.records.ensure(stop.workspaceId, subject, { status: "released", pending: [] })
        const written = await this.records.patch(stop.workspaceId, record.id, (fresh) => {
            if (!holds(fresh)) return { ...freshEpisode(fresh, run, at), ...facts }
            if (fresh.frozenRunId !== run.runId) return null
            return fresh.status === "retrying" ? { ...facts, status: "frozen", failures: fresh.failures + 1 } : null
        })
        const freeze = written ?? (await this.records.byId(stop.workspaceId, record.id))
        if (freeze === null) return null
        if (freeze.frozenRunId !== run.runId) {
            await this.runs.keep(stop.workspaceId, run.runId)
            this.logger.warn(LeadFreezesLogEvent.OtherRunStopped, { freezeId: freeze.id, runId: run.runId })
            return null
        }
        if (written !== null) {
            this.logger.warn(LeadFreezesLogEvent.Frozen, {
                freezeId: freeze.id,
                runId: run.runId,
                code: stop.code,
                failures: freeze.failures,
            })
        }
        return freeze
    }

    /** Raises or updates the owner's one item of the freeze and keeps its id on the freeze. */
    private async raise(workspaceId: string, freeze: LeadFreeze, locale: FreezeLocale): Promise<void> {
        const itemId = await this.items.raise(workspaceId, freeze, locale)
        if (itemId === freeze.workItemId) return
        await this.records.patch(workspaceId, freeze.id, (fresh) =>
            holds(fresh) && fresh.workItemId !== itemId ? { workItemId: itemId } : null,
        )
    }

    /** Where a retry stands: released when the run ended well, frozen again when it stopped, still retrying while it runs. */
    private async settle(workspaceId: string, freeze: LeadFreeze, actor: string): Promise<FreezeOutcome> {
        if (!holds(freeze)) return freeze.releaseReason === "skipped" ? "skipped" : "released"
        const status = freeze.frozenRunId === null ? null : await this.runs.statusOf(workspaceId, freeze.frozenRunId)
        if (status === DONE) {
            await this.release(workspaceId, freeze, "retried", actor)
            return "released"
        }
        if (status !== null && !STOPPED.has(status)) return freeze.status === "retrying" ? "retrying" : "still_frozen"
        await this.records.patch(workspaceId, freeze.id, (fresh) =>
            fresh.status === "retrying" ? { status: "frozen" } : null,
        )
        return "still_frozen"
    }

    /** Releases the customer and writes the pending events again as wakes, in one transaction: the release and the replay never come apart. */
    private async release(
        workspaceId: string,
        freeze: LeadFreeze,
        reason: FreezeReleaseReason,
        actor: string,
    ): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            const released = await this.records.patch(
                workspaceId,
                freeze.id,
                (fresh) =>
                    holds(fresh)
                        ? {
                              status: "released",
                              releasedAt: this.clock.now().toISOString(),
                              releasedBy: actor,
                              releaseReason: reason,
                          }
                        : null,
                tx,
            )
            if (released === null) return
            const events = replayOf(released.pending, reason)
            const written = await this.wakes.replay(tx, workspaceId, released, events)
            this.logger.info(LeadFreezesLogEvent.Released, { freezeId: released.id, reason, replayed: written })
        })
    }
}

/** The trigger scope a node step's input holds, or null. */
const triggerOfInput = (input: Trigger): Trigger | null => (isJsonObject(input.trigger) ? input.trigger : null)

/** The workflow a node step's run is pinned to, or null for an agent's own graph. */
const workflowOfInput = (input: Trigger): string | null =>
    typeof input.workflowId === "string" && input.workflowId !== "" ? input.workflowId : null
