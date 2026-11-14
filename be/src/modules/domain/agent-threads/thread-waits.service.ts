import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { AgentGraphFlowRunsService, callerRunIdOf, subjectOfScope, type FlowWaits } from "@modules/domain/agent-graphs"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { handedBackOf, type AgentTurnView } from "@modules/domain/agent-work"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { InjectGraphThreads, type GraphThreads, type ThreadRef, type ThreadView } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { DeadlineFiring } from "./thread-deadlines.service"
import { ThreadRunsService } from "./thread-runs.service"
import {
    eventOf,
    parkOfWaitQuestion,
    waitOfferOrder,
    waitTakes,
    type WaitCandidate,
    type WaitDeadlinePayload,
} from "./thread-waits.policy"
import { waitMatchProbeOf } from "./wait-match.policy"
import type { ParkSweep } from "./until-round-wakes.service"

@Injectable()
/**
 * The waits of the thread runs (`wait` steps, `TEMPLATE_WAIT_STEP`): a run parked on one is resumed by the FIRST of an event the wait
 * takes (`took`, asked by the flow before any workflow takes the wake) and its deadline (`timedOut`, the thread-deadline job, or the
 * minute sweep when the job did not fire). Both write the run's ONE wait wake (`ThreadRunsService.waitAnswered`, keyed by the park), so
 * a second comer resumes nothing. An event is asked of EVERY run of the wake's agent whose parked wait it may meet, found exactly (the
 * runs parked for the event's subject, and the runs whose wait keys the event names: `wait_match`, written when a wait parks), in the
 * offer order (a child before its parent, then the latest waiter); the run's own park decides (`waitTakes`). No page of runs decides.
 */
export class ThreadWaitsService implements FlowWaits, OnModuleInit {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly runs: ThreadRunsService,
        private readonly flows: AgentGraphFlowRunsService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
        @Optional() private readonly agentRuns?: AgentRunsService,
        @Optional() private readonly attachments?: AccountAttachmentsService,
    ) {}

    /** Registers with the flow once the app has started. */
    onModuleInit(): void {
        this.flows.setWaits(this)
    }

    /**
     * Whether a run of the wake's agent parked on a wait takes this event: the first (in the list's order) whose wait takes it gets the
     * event's wait wake. True when that wake is this event's (written now, or kept from this very wake's earlier try); false when no wait
     * takes it or another comer took the park first (the event then follows its own road).
     */
    async took(turn: AgentTurnView, verb: string, trigger: Readonly<Record<string, unknown>>): Promise<boolean> {
        const { port } = this
        if (port === undefined) return false
        const eventId = typeof trigger.eventId === "string" && trigger.eventId !== "" ? trigger.eventId : null
        for (const candidate of await this.candidatesOf(turn, verb, trigger)) {
            const ref: ThreadRef = { workspaceId: turn.workspaceId, runId: candidate.id }
            // The same event through another agent's wake of it may have taken this run's park first: then it is taken for all.
            const taken = (parkKey: string): Promise<boolean> =>
                this.runs.sameWaitKept(ref, candidate.agentId, parkKey, turn.wakeId, eventId)
            const view = await port.stateOf(ref)
            const park = view?.status === "stopped" ? parkOfWaitQuestion(view.stop?.question) : null
            const key = park === null ? null : waitTakes(park, verb, trigger)
            if (park === null || key === null) continue
            const admission = await this.runs.waitAnswered(ref, park.parkKey, { key, event: eventOf(trigger) }, turn.wakeId)
            if (admission.kind === "refused") {
                if (await taken(park.parkKey)) return true
                continue
            }
            const ours = admission.fresh || (await taken(park.parkKey))
            this.logger.info(AgentThreadsLogEvent.WakeAdmitted, { runId: ref.runId, event: "wait", fresh: admission.fresh })
            if (ours) return true
        }
        return false
    }

    /**
     * A wait's deadline job came (`now`: a person ran it now): the timeout's wake is written when the thread still waits on that very
     * park and it is due; else nothing (`closed`: no park; `moved`: another one; `early`: not due; `refused`: an event took it first).
     */
    async timedOut(payload: WaitDeadlinePayload, now: boolean): Promise<DeadlineFiring> {
        const ref: ThreadRef = { workspaceId: payload.workspaceId, runId: payload.runId }
        const view = (await this.port?.stateOf(ref)) ?? null
        const park = view?.status === "stopped" ? parkOfWaitQuestion(view.stop?.question) : null
        if (park === null) return this.skipped(payload, "closed")
        if (park.parkKey !== payload.stepKey) return this.skipped(payload, "moved")
        if (!now && Date.parse(park.dueAt) > this.clock.now().getTime()) return this.skipped(payload, "early")
        const admission = await this.runs.waitAnswered(ref, park.parkKey, { timeout: true }, null)
        if (admission.kind === "refused" || !admission.fresh) return this.skipped(payload, "refused")
        this.logger.info(AgentThreadsLogEvent.DeadlineFired, { runId: ref.runId, stepKey: park.parkKey, early: now })
        return "admitted"
    }

    /**
     * The sweep's look at a stopped thread: a wait past its timeout by `graceMs` (its job did not fire) gets its timeout's wake; one not
     * due yet is left waiting; any other stop is not a wait (null).
     */
    async swept(ref: ThreadRef, view: ThreadView, graceMs: number): Promise<ParkSweep> {
        const park = parkOfWaitQuestion(view.stop?.question)
        if (park === null) return null
        if (Date.parse(park.dueAt) > this.clock.now().getTime() - graceMs) return "waiting"
        const admission = await this.runs.waitAnswered(ref, park.parkKey, { timeout: true }, null)
        return admission.kind === "admitted" && admission.fresh ? "fired" : "waiting"
    }

    /**
     * The runs whose waits are asked, in the offer order: the agent's runs parked for the event's own subject (exact, through the run's
     * subject columns) and every run whose parked wait's keys the event's probe names (exact, through `wait_match`: an `eq` test, a
     * `contains` part found in the event's text, the subject members of a trigger with no test). Each run once; no page of the agent's
     * runs decides who is found.
     */
    private async candidatesOf(
        turn: AgentTurnView,
        verb: string,
        trigger: Readonly<Record<string, unknown>>,
    ): Promise<ReadonlyArray<{ readonly id: string; readonly agentId: string }>> {
        const { agentRuns } = this
        if (agentRuns === undefined) return []
        const subject = subjectOfScope(turn)
        const own = subject === null ? [] : await agentRuns.parkedOfSubject(turn.workspaceId, turn.agentId, subject)
        const agentIds = await this.agentsOf(turn)
        const matched = await agentRuns.waitersOf(turn.workspaceId, { agentIds, ...waitMatchProbeOf(verb, trigger) })
        const agentOf = new Map<string, string>([...own, ...matched].map((run) => [run.id, run.agentId]))
        // An event is offered to each run at most once: a run that took it and handed it back is never asked again.
        const handedBack = new Set(handedBackOf(turn.context))
        const candidates: ReadonlyArray<WaitCandidate> = [
            ...matched.map((run) => ({ id: run.id, callerRunId: callerRunIdOf(run.context), waitSince: run.waitSince })),
            ...own.map((run) => ({ id: run.id, callerRunId: callerRunIdOf(run.context), waitSince: null })),
        ].filter((candidate) => !handedBack.has(candidate.id))
        return waitOfferOrder(candidates).map((id) => ({ id, agentId: agentOf.get(id) ?? turn.agentId }))
    }

    /**
     * The agents whose parked waits an event is asked of: the wake's own, and, for an event that came through an account, every agent
     * attached to that account (attachment is an agent's right to the account's events, the same right a registration needs). So a run
     * of one agent parked for a person's next line takes it before the graph another agent registers on the line starts (lane concept
     * engine-core rule 8: the waits first, then the registered graphs), and each of the event's wakes finds it taken.
     */
    private async agentsOf(turn: AgentTurnView): Promise<ReadonlyArray<string>> {
        const connectionId = turn.context.connectionId
        if (connectionId === undefined || connectionId === "" || this.attachments === undefined) return [turn.agentId]
        const attached = await this.attachments.listOfWorkspace(turn.workspaceId)
        return [...new Set([turn.agentId, ...attached.filter((one) => one.connectionId === connectionId).map((one) => one.agentId)])]
    }

    private skipped(payload: WaitDeadlinePayload, code: Exclude<DeadlineFiring, "admitted">): DeadlineFiring {
        this.logger.info(AgentThreadsLogEvent.DeadlineSkipped, { runId: payload.runId, stepKey: payload.stepKey, code })
        return code
    }
}
