import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { RunStopsService, ThreadRunsService, ThreadSweepService } from "@modules/domain/agent-threads"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"
import {
    THREAD_RELEASER,
    isRunClosed,
    isThreadHold,
    oldestStopOf,
    stopHoldsWake,
    stopIsAbout,
    stopSubjectOf,
    threadHoldOf,
} from "./lead-freeze-threads.policy"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import { holds, pendingEventOf, takenByRun, withPending, withTaken, workflowOfTrigger } from "./lead-freeze.policy"
import type { FreezeOutcome, FreezeSubject, FreezeTrigger, HeldStop, LeadFreeze, PendingEvent } from "./lead-freezes.contracts"

/** The fact a stop keeps per event that joined its run while it waits (`joined:<wake id>`, the time it arrived). */
export const JOINED_EVENT_FACT = "joined"

/** Why a held event is not replayed: it joined the waiting run, whose re-run after the founder's decision read it. */
const JOINED_RUN = "joined_run"

@Injectable()
/**
 * The hold of a thread run's stop (`engine = langgraph`): while a stop of a run of the customer's workflow stands open, a new wake of
 * that customer and workflow starts no run and is kept as a pending event on a freeze that points at the run and its stopped step. No
 * owner item, no retry, no take-over: the stop (its card, its answer box, its decisions) is the one thing that tells the founder. When
 * no stop of the run is open any more (the step completed after an answer, the founder skipped, a deadline moved it, the run is over)
 * the customer is released and the pending events are written again as wakes, once, in the order they came. It registers on the
 * thread runs (after every drive) and on the thread sweep (per workspace) when the app starts.
 */
export class LeadFreezeStopHoldsService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly records: LeadFreezeRecordsService,
        private readonly runs: AgentRunsService,
        private readonly wakes: LeadFreezeWakesService,
        private readonly stops: LeadFreezeStopsService,
        @Optional() private readonly threadRuns?: ThreadRunsService,
        @Optional() private readonly sweep?: ThreadSweepService,
        @Optional() private readonly runStops?: RunStopsService,
        @Optional() private readonly agentWakes?: DeliveredWakesService,
    ) {}

    /** Registers on the thread runs and the thread sweep once the app has started (an app with no threads registers nothing). */
    onModuleInit(): void {
        this.threadRuns?.whenSettled((ref) => this.threadSettled(ref.workspaceId, ref.runId))
        this.sweep?.alsoPerWorkspace(async (workspaceId) => {
            await this.settleThreads(workspaceId)
        })
    }

    /** True when the wake, tried again, already opened this run: the wake that opened a stopped run is never held by that run. */
    async isOwnRun(turn: AgentTurnView, runId: string | null): Promise<boolean> {
        return runId !== null && (await this.ownRunOf(turn)) === runId
    }

    /**
     * Holds the wake for an open stop about the customer in the trigger's workflow: true when it was recorded as a pending event,
     * false when no such stop is open (the wake starts its run).
     */
    async holdFor(turn: AgentTurnView, trigger: FreezeTrigger, subject: FreezeSubject): Promise<boolean> {
        const stop = await this.holding(turn.workspaceId, trigger, subject, turn)
        return stop !== null && this.holdOn(turn, trigger, stopSubjectOf(subject, stop), stop)
    }

    /** Records the wake as a pending event on the hold of `keyed` for `stop`, starting the hold when none stands. */
    private async holdOn(turn: AgentTurnView, trigger: FreezeTrigger, keyed: FreezeSubject, stop: HeldStop): Promise<boolean> {
        const at = this.clock.now().toISOString()
        const event = pendingEventOf(turn, trigger, at)
        const name = keyed.contactId === null ? null : await this.records.nameOfContact(turn.workspaceId, keyed.contactId)
        const record = await this.records.ensure(turn.workspaceId, keyed, { status: "released", pending: [] })
        // A freeze of the old engine left on the same key holds nobody any more: the stop's hold takes its place.
        const held = await this.records.patch(turn.workspaceId, record.id, (fresh) =>
            holds(fresh) && isThreadHold(fresh)
                ? { pending: withPending(fresh.pending, event) }
                : {
                      ...threadHoldOf(fresh, stop, at),
                      ...(name === null ? {} : { customerName: name }),
                      ...(keyed.conversationId === null ? {} : { conversationId: keyed.conversationId }),
                      pending: [event],
                  },
        )
        if (held === null) return false
        await this.joinedShown(turn.workspaceId, stop, event, trigger)
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
     * Tells the stop an event joined its run: one fact per joined event (`joined:<wake>`, its
     * time), so the card, rewritten in place, shows what arrived while it waits. A failure is logged; the hold stands.
     */
    private async joinedShown(workspaceId: string, stop: HeldStop, event: PendingEvent, trigger: FreezeTrigger): Promise<void> {
        if (this.runStops === undefined) return
        try {
            await this.runStops.factsAdded(
                { workspaceId, runId: stop.runId },
                stop.stepKey,
                [{ name: `${JOINED_EVENT_FACT}:${event.wakeId}`, value: event.at }],
                { locale: trigger.locale === "en" ? "en" : "vi" },
            )
        } catch (cause) {
            this.logger.error(LeadFreezesLogEvent.SettleFailed, cause, { runId: stop.runId })
        }
    }

    /**
     * The oldest open stop that holds a wake of the trigger's workflow for the customer, of a run that is not over and is not the wake's
     * own run; null when none does.
     */
    async holding(
        workspaceId: string,
        trigger: FreezeTrigger,
        subject: FreezeSubject,
        turn: AgentTurnView | null,
    ): Promise<HeldStop | null> {
        const workflowId = workflowOfTrigger(trigger)
        const about = (await this.openAbout(workspaceId, subject)).filter((stop) => stopHoldsWake(stop, workflowId, subject))
        if (about.length === 0) return null
        const ownRunId = turn === null ? null : await this.ownRunOf(turn)
        const open = about.filter((stop) => stop.runId !== ownRunId)
        if (open.length === 0) return null
        const statuses = await Promise.all(open.map((stop) => this.statusOf(workspaceId, stop.runId)))
        return oldestStopOf(open.filter((_, at) => !isRunClosed(statuses[at] ?? null)))
    }

    /** The open stops of thread runs about the customer, whatever the workflow. */
    async openAbout(workspaceId: string, subject: FreezeSubject): Promise<ReadonlyArray<HeldStop>> {
        return (await this.stops.openOfCustomer(workspaceId, subject)).filter((stop) => stopIsAbout(stop, subject))
    }

    /**
     * Where a hold stands: still held while a stop of its run stands open (the freeze follows the step that stopped last), released
     * with every pending event replayed once, in order, when none does or the run is over.
     */
    async settle(workspaceId: string, freeze: LeadFreeze): Promise<FreezeOutcome> {
        if (!holds(freeze)) return "released"
        const open = freeze.frozenRunId === null ? null : await this.openStopOfRun(workspaceId, freeze.frozenRunId)
        if (open !== null) {
            if (open.stepKey !== freeze.stepKey)
                await this.records.patch(workspaceId, freeze.id, (fresh) =>
                    holds(fresh) && fresh.stepKey !== open.stepKey ? { stepKey: open.stepKey } : null,
                )
            return "on_stop"
        }
        await this.release(workspaceId, freeze)
        return "released"
    }

    /**
     * After a drive of a thread run (it stopped, waits or ended): when the run holds a customer and no stop of it stands open any more,
     * the customer is released and their pending events replayed now, instead of on their next wake. A failure is logged and left to
     * the next wake or the next sweep; it never fails the drive.
     */
    async threadSettled(workspaceId: string, runId: string): Promise<void> {
        try {
            await this.releaseWaitingOf(workspaceId, runId)
            const freeze = await this.records.byRun(workspaceId, runId)
            if (!holds(freeze) || !isThreadHold(freeze)) return
            await this.settle(workspaceId, freeze)
        } catch (cause) {
            this.logger.error(LeadFreezesLogEvent.SettleFailed, cause, { runId })
        }
    }

    /**
     * The final rule: the events of a subject that waited behind its run in flight (wakes held `waiting:<run>`) go to the NEXT run once
     * that run has ended (done, failed, skipped, cancelled); while it is in flight they stay held (only its waits take events).
     */
    private async releaseWaitingOf(workspaceId: string, runId: string): Promise<void> {
        if (this.agentWakes === undefined || !isRunClosed(await this.statusOf(workspaceId, runId))) return
        const wakes = this.agentWakes
        const released = await this.entityManager.transaction((tx) => wakes.releaseWaiting(tx, workspaceId, runId))
        if (released > 0) this.logger.info(LeadFreezesLogEvent.Released, { freezeId: "", reason: "run_ended", replayed: released, joinedRun: 0 })
    }

    /** Settles every hold of a thread run's stop in the workspace (the sweep's backstop); answers how many it released. */
    async settleThreads(workspaceId: string): Promise<number> {
        const threadHolds = (await this.records.holding(workspaceId)).filter(isThreadHold)
        let released = 0
        await eachInOrder(threadHolds, async (freeze) => {
            if ((await this.settle(workspaceId, freeze)) === "released") released += 1
        })
        return released
    }

    /** The open stop of a run that is not over, or null. */
    private async openStopOfRun(workspaceId: string, runId: string): Promise<HeldStop | null> {
        if (isRunClosed(await this.statusOf(workspaceId, runId))) return null
        return oldestStopOf(await this.stops.openOfRun(workspaceId, runId))
    }

    /** The run a wake tried again already opened, or null (a wake on its first try opened none). */
    private async ownRunOf(turn: AgentTurnView): Promise<string | null> {
        return turn.attempts > 1 ? this.runs.runIdOfWake(turn.workspaceId, turn.wakeId) : null
    }

    /** Where a run stands, or null when it is gone. */
    private async statusOf(workspaceId: string, runId: string): Promise<string | null> {
        return (await this.runs.runOf(workspaceId, runId))?.status ?? null
    }

    /**
     * The events held for a run that no step took yet, oldest first: what a step visit of the run finds queued for it while the run waited
     * at a stop (ROAD-API section 4). None when no hold of the run stands.
     */
    async untakenOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<PendingEvent>> {
        const freeze = await this.records.byRun(workspaceId, runId)
        if (freeze === null || !holds(freeze)) return []
        return freeze.pending.filter((event) => event.taken === undefined && !event.folded)
    }

    /** Records that a step visit of the run took these held events (`<run>:<step>:<visit>`); a replay of the same marks changes nothing. */
    async markTaken(workspaceId: string, runId: string, wakeIds: ReadonlyArray<string>, visit: string): Promise<void> {
        if (wakeIds.length === 0) return
        const freeze = await this.records.byRun(workspaceId, runId)
        if (freeze === null) return
        const taking = new Set(wakeIds)
        await this.records.patch(workspaceId, freeze.id, (fresh) =>
            fresh.pending.some((event) => event.taken === undefined && taking.has(event.wakeId))
                ? { pending: withTaken(fresh.pending, taking, visit) }
                : null,
        )
    }

    /** Releases the customer and writes the pending events again as wakes, in one transaction: the release and the replay never come apart. */
    private async release(workspaceId: string, freeze: LeadFreeze): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            const released = await this.records.patch(
                workspaceId,
                freeze.id,
                (fresh) =>
                    holds(fresh)
                        ? {
                              status: "released",
                              releasedAt: this.clock.now().toISOString(),
                              releasedBy: THREAD_RELEASER,
                              releaseReason: "stop_closed",
                          }
                        : null,
                tx,
            )
            if (released === null) return
            // The queue rule (ROAD-API section 4): an event a step of the run TOOK into its queue snapshot (`ctx.run.queue`) is the run's
            // work, never a run of its own; every event no step took is replayed, in order, as the next run of its key.
            const joined = takenByRun(released.pending)
            const replayed = released.pending.filter((event) => !joined.includes(event))
            const ran = await this.wakes.dropped(tx, workspaceId, joined, JOINED_RUN)
            const written = await this.wakes.replay(tx, workspaceId, released, replayed)
            this.logger.info(LeadFreezesLogEvent.Released, {
                freezeId: released.id,
                reason: "stop_closed",
                replayed: written,
                joinedRun: ran,
            })
        })
    }
}
