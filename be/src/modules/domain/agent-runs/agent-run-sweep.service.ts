import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { InjectAgentRunItemVerdicts, InjectAgentRunWaitTimeout } from "./agent-runs.decorators"
import type { StepDecision, StepView } from "./agent-runs.contracts"
import { SWEEP_LIMIT, WAIT_TIMEOUT, DECISION_ACTOR_UNKNOWN } from "./policies/agent-runs.policy"
import type {
    AgentRunItemVerdicts,
    AgentRunWaitTimeout,
    RunDue,
    RunStepView,
    RunSweepReport,
} from "./agent-runs-engine.contracts"

/** The verdict of a wait that ran out: refused, by the clock. */
const TIMED_OUT: StepDecision = { approved: false, by: "timeout" }

/** What handling one due item did, for the report. */
type Done = keyof RunSweepReport | null

/** A terminal timeout failure whose notification runs after the decision-owner transaction released its lock. */
interface TimeoutFailure {
    /** The claimed step. */
    readonly step: StepView
    /** Why a person must reconcile it. */
    readonly code: string
}

@Injectable()
/**
 * The backstop under the saga, run inside the minute sweep of the agent work (one pass over what the database says is due, bounded, one
 * failing item never stopping the rest). A step whose claim ran out is resumed, retried or stopped visibly by the same claim a job takes;
 * a wait past its deadline gets the graph's timeout; a ready step no job picked up is driven; an undo is continued; a run that stopped and
 * was never told to a person is told; a run parked for a fix is put back on its failed step once its pause has passed. Nothing it finds is left silent.
 */
export class AgentRunSweepService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly store: AgentRunStoreService,
        private readonly handlers: AgentRunHandlersService,
        private readonly runs: AgentRunsService,
        private readonly steps: AgentRunStepsService,
        private readonly ledger: AgentStepLedgerService,
        private readonly compensation: AgentRunCompensationService,
        private readonly deadLetter: AgentRunDeadLetterService,
        @InjectAgentRunWaitTimeout() private readonly timeouts: AgentRunWaitTimeout,
        @InjectAgentRunItemVerdicts() private readonly verdicts: AgentRunItemVerdicts,
        private readonly resume: AgentRunResumeService,
    ) {}

    /** Runs one pass and answers what it did. */
    async sweep(): Promise<RunSweepReport> {
        const recovered = await this.recover()
        const due = await this.store.due(SWEEP_LIMIT)
        const done: Array<Done> = []
        await eachInOrder(due, async (item) => {
            done.push(await this.guarded(item))
        })
        const count = (kind: keyof RunSweepReport): number => done.filter((entry) => entry === kind).length
        return {
            expired: count("expired"),
            ready: count("ready"),
            compensating: count("compensating"),
            unspoken: count("unspoken"),
            recovered,
            parked: await this.resumeParked(),
        }
    }

    /** Puts the parked runs that waited long enough back on their failed step; a failing pass never stops the rest of the sweep. */
    private async resumeParked(): Promise<number> {
        try {
            return (await this.resume.resumeParked(false)).resumed
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.SweepItemFailed, cause, { kind: "parked" })
            return 0
        }
    }

    /**
     * Reads the work item of every open wait first: an item that closed by a decision finishes its wait with that decision, whatever the
     * deadline says, so a crash between the close and the resume never turns an approval into a timeout. Bounded to one batch.
     */
    private async recover(): Promise<number> {
        const waits = await this.store.openWaits(SWEEP_LIMIT)
        const known = await this.verdicts.verdictsOf(
            waits.flatMap((wait) => (wait.waitItemId === null ? [] : [wait.waitItemId])),
        )
        const resumed: Array<boolean> = []
        await eachInOrder([...known], async ([itemId, decision]) => {
            try {
                if (decision.approved && decision.by === null) {
                    const wait = waits.find((candidate) => candidate.waitItemId === itemId)
                    if (wait !== undefined) {
                        const view = await this.store.waitingOn(this.entityManager, itemId)
                        if (view !== null && view.stepKey === wait.stepKey && view.fence === wait.fence)
                            await this.steps.fail(view, DECISION_ACTOR_UNKNOWN, false, new AbortController().signal)
                    }
                    return
                }
                resumed.push(
                    await this.entityManager.transaction((tx) => this.runs.resumeWaiting(tx, itemId, decision)),
                )
            } catch (cause) {
                this.logger.error(AgentRunsLogEvent.SweepItemFailed, cause, { kind: "recover", itemId })
            }
        })
        return resumed.filter(Boolean).length
    }

    private async guarded(item: RunDue): Promise<Done> {
        try {
            return await this.handle(item)
        } catch (cause) {
            this.logger.error(AgentRunsLogEvent.SweepItemFailed, cause, { kind: item.kind, runId: item.runId })
            return null
        }
    }

    private async handle(item: RunDue): Promise<Done> {
        const signal = new AbortController().signal
        if (item.kind === "unspoken") {
            const run = await this.store.runById(item.runId)
            await this.deadLetter.tell(item.runId, null, run?.errorCode ?? "unknown")
            return "unspoken"
        }
        if (item.kind === "compensating") {
            await this.compensation.run(item.runId, signal)
            return "compensating"
        }
        if (item.kind === "ready") {
            await this.runs.advance(item.runId, signal)
            return "ready"
        }
        const step = await this.store.stepOf(item.runId, item.stepKey)
        if (step?.status !== "running" || step.fence !== item.fence) return null
        if (step.waitItemId === null) await this.runs.advance(item.runId, signal)
        else await this.expireWait(item, step, step.waitItemId, signal)
        return "expired"
    }

    /** Applies the graph policy and wait outcome while holding the same work-item row a human reopen must update. */
    private async expireWait(item: RunDue, step: RunStepView, workItemId: string, signal: AbortSignal): Promise<void> {
        this.logger.warn(AgentRunsLogEvent.WaitExpired, { runId: item.runId, stepKey: step.stepKey })
        const failure = await this.entityManager.transaction((manager) =>
            this.expireIn(manager, item, step, workItemId),
        )
        if (failure !== null) await this.steps.fail(failure.step, failure.code, false, signal)
    }

    private async expireIn(
        manager: EntityManager,
        item: RunDue,
        step: RunStepView,
        workItemId: string,
    ): Promise<TimeoutFailure | null> {
        const owner = await this.verdicts.claimTimeout(manager, item.workspaceId, workItemId)
        if (owner.kind === "busy") return null
        const view = (await this.store.viewsOf(item.runId, manager)).find(
            (candidate) => candidate.stepKey === step.stepKey,
        )
        const fresh = await this.store.stepOf(item.runId, step.stepKey, manager)
        if (
            view === undefined ||
            fresh?.status !== "running" ||
            fresh.fence !== step.fence ||
            fresh.waitItemId !== workItemId
        )
            return null
        if (owner.kind === "closed") return this.resumeTimeout(manager, workItemId, view, owner.decision)
        const expiry = await this.timeouts.expire(workItemId, manager)
        const after = await this.verdicts.claimTimeout(manager, item.workspaceId, workItemId)
        if (after.kind === "closed") return this.resumeTimeout(manager, workItemId, view, after.decision)
        if (after.kind === "busy") return null
        if (expiry.kind === "renewed") {
            await this.ledger.commitIn(manager, view, { kind: "wait", workItemId, deadlineAt: expiry.deadlineAt })
            return null
        }
        if (this.handlers.of(view.kind)?.onDecided === undefined) return { step: view, code: WAIT_TIMEOUT }
        await this.runs.resumeWaiting(manager, workItemId, TIMED_OUT)
        return null
    }

    private async resumeTimeout(
        manager: EntityManager,
        workItemId: string,
        step: StepView,
        decision: StepDecision,
    ): Promise<TimeoutFailure | null> {
        if (decision.approved && decision.by === null) return { step, code: DECISION_ACTOR_UNKNOWN }
        await this.runs.resumeWaiting(manager, workItemId, decision)
        return null
    }
}
