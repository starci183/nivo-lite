import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunDeadLetterService } from "./agent-run-dead-letter.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsService } from "./agent-runs.service"
import { AgentRunsLogEvent } from "./agent-runs.log-events"
import { InjectAgentRunItemVerdicts, InjectAgentRunWaitTimeout } from "./agent-runs.decorators"
import type { StepDecision } from "./agent-runs.contracts"
import { SWEEP_LIMIT, WAIT_TIMEOUT } from "./policies/agent-runs.policy"
import type { AgentRunItemVerdicts, AgentRunWaitTimeout, RunDue, RunStepView, RunSweepReport } from "./agent-runs-engine.contracts"

/** The verdict of a wait that ran out: refused, by the clock. */
const TIMED_OUT: StepDecision = { approved: false, by: "timeout" }

/** What handling one due item did, for the report. */
type Done = keyof RunSweepReport | null

@Injectable()
/**
 * The backstop under the saga, run inside the minute sweep of the agent work (one pass over what the database says is due, bounded, one
 * failing item never stopping the rest). A step whose claim ran out is resumed, retried or stopped visibly by the same claim a job takes;
 * a wait past its deadline gets the graph's timeout; a ready step no job picked up is driven; an undo is continued; a run that stopped and
 * was never told to a person is told. Nothing it finds is left silent.
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
        }
    }

    /**
     * Reads the work item of every open wait first: an item that closed by a decision finishes its wait with that decision, whatever the
     * deadline says, so a crash between the close and the resume never turns an approval into a timeout. Bounded to one batch.
     */
    private async recover(): Promise<number> {
        const waits = await this.store.openWaits(SWEEP_LIMIT)
        const known = await this.verdicts.verdictsOf(waits.flatMap((wait) => (wait.waitItemId === null ? [] : [wait.waitItemId])))
        const resumed: Array<boolean> = []
        await eachInOrder([...known], async ([itemId, decision]) => {
            try {
                resumed.push(await this.entityManager.transaction((tx) => this.runs.resumeWaiting(tx, itemId, decision)))
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

    /** Applies the graph's timeout to a wait past its deadline; a wait the graph did not renew or answer stops visibly. */
    private async expireWait(item: RunDue, step: RunStepView, workItemId: string, signal: AbortSignal): Promise<void> {
        this.logger.warn(AgentRunsLogEvent.WaitExpired, { runId: item.runId, stepKey: step.stepKey })
        const expiry = await this.timeouts.expire(workItemId)
        const view = (await this.store.viewsOf(item.runId)).find((candidate) => candidate.stepKey === step.stepKey)
        const fresh = await this.store.stepOf(item.runId, step.stepKey)
        const stillWaiting = fresh?.status === "running" && fresh.fence === step.fence && fresh.waitItemId !== null
        if (view === undefined || !stillWaiting) return
        if (expiry.kind === "renewed") {
            await this.ledger.commit(view, { kind: "wait", workItemId, deadlineAt: expiry.deadlineAt })
            return
        }
        if (this.handlers.of(view.kind)?.onDecided === undefined) {
            await this.steps.fail(view, WAIT_TIMEOUT, false, signal)
            return
        }
        await this.entityManager.transaction((tx) => this.runs.resumeWaiting(tx, workItemId, TIMED_OUT))
    }
}
