import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { ADVANCE_MAX_STEPS, STEP_TIMEOUT } from "./policies/agent-runs.policy"
import type { RunOpen, StepSpec } from "./agent-runs.contracts"
import type { ClaimResult, InlineResult, RunAdvance, RunView, StepEnd, WaitAnswer } from "./agent-runs-engine.contracts"

/** What a claim that did not run the step says to the caller that named the step. */
const refusalOf = (claim: ClaimResult): string => {
    if (claim.kind === "later") return "retry_later"
    return claim.kind === "busy" ? "step_busy" : "step_closed"
}

@Injectable()
/**
 * The saga engine: one run per wake, the steps of the run, and the three ways to drive them (inline under the wake's lease, the agent-step
 * job, the sweep), which all take the same claim and so never run one step twice at once. It holds the order and no business: a step's
 * handler does the work, the failure policy decides where a failure goes.
 */
export class AgentRunsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly store: AgentRunStoreService,
        private readonly ledger: AgentStepLedgerService,
        private readonly steps: AgentRunStepsService,
        private readonly compensation: AgentRunCompensationService,
    ) {}

    /** Opens the one run of a wake in `tx`; a replay of the same wake answers the run it already has. */
    open(tx: EntityManager, input: RunOpen): Promise<RunView> {
        return this.store.open(tx, input)
    }

    /** Writes steps behind the last one of the run and the job that drives them, in `tx`; a step key already written is left as it is. */
    async append(tx: EntityManager, runId: string, specs: ReadonlyArray<StepSpec>): Promise<void> {
        if (specs.length === 0) return
        const run = await this.store.runIn(tx, runId)
        await this.store.append(tx, { runId, workspaceId: run.workspaceId }, specs)
    }

    /**
     * Drives the pending steps of the run, in order, until one waits, is held by its backoff, fails or the run ends; an undo in progress is
     * continued. At most a bounded number of steps run in one call, the rest is the job's. Safe to call while another worker drives the same run.
     */
    async advance(runId: string, signal: AbortSignal): Promise<RunAdvance> {
        const retryAfterMs = await this.drive(runId, signal, ADVANCE_MAX_STEPS)
        return { run: await this.store.runById(runId), retryAfterMs }
    }

    private async drive(runId: string, signal: AbortSignal, left: number): Promise<number | null> {
        if (left <= 0 || signal.aborted) return null
        const claim = await this.ledger.claim(runId, null)
        if (claim.kind === "claimed") {
            const end = await this.steps.execute(claim.step, signal)
            return end.kind === "done" ? this.drive(runId, signal, left - 1) : null
        }
        if (claim.kind === "exhausted") await this.steps.fail(claim.step, STEP_TIMEOUT, false, signal)
        if (claim.kind === "closed") await this.compensation.run(runId, signal)
        return claim.kind === "later" ? claim.retryAfterMs : null
    }

    /**
     * Adds one step to the run of the wake, runs it now through its handler and answers its result: a tool called from inside the model turn.
     * A replay of the same step key answers the stored result and never calls the handler. A step that waits answers `{ waiting: true }`; one
     * that does not finish throws with the code that says why.
     */
    async runInline(wakeId: string, spec: StepSpec, signal: AbortSignal): Promise<InlineResult> {
        const run = await this.store.runOfWake(wakeId)
        if (run === null) throw new AgentRunsError({ code: AgentRunsErrorCode.RunNotFound })
        await this.entityManager.transaction((tx) =>
            this.store.append(tx, { runId: run.id, workspaceId: run.workspaceId }, [spec]),
        )
        const claim = await this.ledger.claim(run.id, spec.stepKey)
        if (claim.kind === "done") return claim.answer ?? {}
        if (claim.kind === "exhausted") return this.endOf(await this.steps.fail(claim.step, STEP_TIMEOUT, false, signal))
        if (claim.kind !== "claimed") throw this.refused(refusalOf(claim))
        return this.endOf(await this.steps.execute(claim.step, signal))
    }

    /**
     * A person's answer, inside the decision's own transaction: finishes the step that waits on the work item and writes the steps that follow
     * with the job that drives them. The engine calls no performer: the handler of the next step does the work. False when no step waits on the item.
     */
    resumeWaiting(tx: EntityManager, workItemId: string, answer: WaitAnswer): Promise<boolean> {
        return this.store.resume(tx, workItemId, answer)
    }

    private endOf(end: StepEnd): InlineResult {
        if (end.kind === "done") return end.result
        if (end.kind === "wait") return { waiting: true, workItemId: end.workItemId }
        throw this.refused(end.kind === "failed" ? end.code : "fenced")
    }

    private refused(code: string): AgentRunsError {
        return new AgentRunsError({ code: AgentRunsErrorCode.StepFailed, params: { code } })
    }
}
