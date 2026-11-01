import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentRunCompensationService } from "./agent-run-compensation.service"
import { AgentRunHandlersService } from "./agent-run-handlers.service"
import { AgentRunInflightService } from "./agent-run-inflight.service"
import { AgentRunStepsService } from "./agent-run-steps.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { ADVANCE_MAX_STEPS, STEP_TIMEOUT } from "./policies/agent-runs.policy"
import type { RunOpen, StepDecision, StepSpec } from "./agent-runs.contracts"
import type { ClaimResult, InlineResult, RunAdvance, RunView, StepEnd } from "./agent-runs-engine.contracts"

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
        private readonly handlers: AgentRunHandlersService,
        private readonly inflight: AgentRunInflightService,
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
        if (left <= 0 || signal.aborted || this.inflight.closed) return null
        const claim = await this.ledger.claim(runId, null)
        if (claim.kind === "claimed") {
            const end = await this.inflight.track(claim.step, () => this.steps.execute(claim.step, signal))
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
        if (this.inflight.closed) throw this.refused("shutting_down")
        const run = await this.store.runOfWake(wakeId)
        if (run === null) throw new AgentRunsError({ code: AgentRunsErrorCode.RunNotFound })
        await this.entityManager.transaction((tx) =>
            this.store.append(tx, { runId: run.id, workspaceId: run.workspaceId }, [spec]),
        )
        const claim = await this.ledger.claim(run.id, spec.stepKey)
        if (claim.kind === "done") return claim.answer ?? {}
        if (claim.kind === "exhausted") return this.endOf(await this.steps.fail(claim.step, STEP_TIMEOUT, false, signal))
        if (claim.kind !== "claimed") throw this.refused(refusalOf(claim))
        return this.endOf(await this.inflight.track(claim.step, () => this.steps.execute(claim.step, signal)))
    }

    /**
     * The runtime that was answering the wake went down: the step it held fails with `code` and goes through the failure policy, so it is tried
     * again after a backoff and, when its tries are spent, a person is told and the customer gets the honest line. Never silent.
     */
    async interrupted(wakeId: string, code: string, signal: AbortSignal): Promise<void> {
        const run = await this.store.runOfWake(wakeId)
        if (run === null) return
        const heldKey = (await this.store.stepsOf(this.entityManager, run.id)).find(
            (step) => step.status === "running" && step.waitItemId === null,
        )?.stepKey
        const held = (await this.store.viewsOf(run.id)).find((step) => step.stepKey === heldKey)
        if (held !== undefined) await this.steps.fail(held, code, true, signal)
    }

    /**
     * A person's verdict on the work item a step waits on, inside the decision's own transaction: the wait step's handler turns it into the
     * step's result and the steps that follow (the verdict itself when the handler has no `onDecided`), and they are written with the job that
     * drives them. The engine calls no performer. A second verdict for the same item finds no waiting step and answers false.
     */
    async resumeWaiting(tx: EntityManager, workItemId: string, decision: StepDecision): Promise<boolean> {
        const step = await this.store.waitingOn(tx, workItemId)
        if (step === null) return false
        const answer = this.handlers.of(step.kind)?.onDecided?.(step, decision)
        const verdict = { result: { approved: decision.approved, by: decision.by }, next: [] }
        return this.store.resume(tx, workItemId, answer?.kind === "done" ? { result: answer.result, next: answer.next } : verdict)
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
