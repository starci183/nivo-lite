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
import { ADVANCE_MAX_STEPS, STEP_TIMEOUT, DECISION_ACTOR_UNKNOWN } from "./policies/agent-runs.policy"
import type {
    RunOpen,
    RunWait,
    StepDecision,
    StepSpec,
    StepLink,
    StepJson,
    OptionalRunWait,
} from "./agent-runs.contracts"
import type {
    ClaimResult,
    InlineResult,
    OptionalRunView,
    RunAdvance,
    RunView,
    StepEnd,
} from "./agent-runs-engine.contracts"

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

    /** The run, or null when there is none: what a notice about it needs to name its workspace, agent and conversation. */
    runOf(runId: string): Promise<OptionalRunView> {
        return this.store.runById(runId)
    }

    /** Registers a durable wait in the work item's transaction; the item cannot become visible before its waiting step. */
    async waitOn(tx: EntityManager, input: RunWait): Promise<void> {
        const run = await this.store.runOfWake(input.wakeId, tx)
        if (run === null) throw new AgentRunsError({ code: AgentRunsErrorCode.RunNotFound })
        if (run.workspaceId !== input.workspaceId) throw this.refused("wait_scope")
        const waiting = await this.store.waitingOn(tx, input.workItemId)
        if (waiting?.runId === run.id && waiting.stepKey === input.spec.stepKey) return
        if (waiting !== null) throw this.refused("wait_conflict")
        await this.store.appendRows(tx, { runId: run.id, workspaceId: run.workspaceId }, [input.spec])
        const claim = await this.ledger.claimIn(tx, run.id, input.spec.stepKey)
        if (claim.kind === "done") return
        if (claim.kind !== "claimed") throw this.refused(refusalOf(claim))
        const committed = await this.ledger.commitIn(tx, claim.step, {
            kind: "wait",
            workItemId: input.workItemId,
            deadlineAt: input.deadlineAt,
        })
        if (committed === "fenced") throw this.refused("fenced")
    }

    /** Whether an active run in the workspace owns the work item's wait; proposal fields never establish this link. */
    async waitsOn(workspaceId: string, workItemId: string): Promise<boolean> {
        return (await this.waitOf(workspaceId, workItemId)) !== null
    }

    /** Reads persisted lifecycle links even after a wait finished; a mutable proposal cannot remove them. */
    linksFor(workspaceId: string, kind: string, key: string, value: string): Promise<ReadonlyArray<StepLink>> {
        return this.store.linksFor(workspaceId, kind, key, value)
    }

    /** The active wait owned by this workspace; its consumer validates its own kind and input. */
    async waitOf(workspaceId: string, workItemId: string): Promise<OptionalRunWait> {
        const step = await this.store.waitingOn(this.entityManager, workItemId)
        return step?.workspaceId === workspaceId ? step : null
    }

    /**
     * Drives ready steps in order; a wait parks its branch while ready siblings continue. Backoff, failure or no ready step ends the pass;
     * an undo in progress is continued. At most a bounded number of steps run in one call, the rest is the job's. Claims fence other workers.
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
            return end.kind === "done" || end.kind === "wait" ? this.drive(runId, signal, left - 1) : null
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
        const kept = await this.completedResult(run.id, spec.stepKey)
        if (kept !== undefined) return kept
        await this.entityManager.transaction((tx) =>
            this.store.append(tx, { runId: run.id, workspaceId: run.workspaceId }, [spec]),
        )
        const claim = await this.ledger.claim(run.id, spec.stepKey)
        if (claim.kind === "done") return claim.answer ?? {}
        if (claim.kind === "closed") {
            const raced = await this.completedResult(run.id, spec.stepKey)
            if (raced !== undefined) return raced
        }
        if (claim.kind === "exhausted")
            return this.endOf(await this.steps.fail(claim.step, STEP_TIMEOUT, false, signal))
        if (claim.kind !== "claimed") throw this.refused(refusalOf(claim))
        return this.endOf(await this.inflight.track(claim.step, () => this.steps.execute(claim.step, signal)))
    }

    /** A completed inline stage replays its persisted answer even after its run ended, without reopening it. */
    private async completedResult(runId: string, stepKey: string): Promise<StepJson | undefined> {
        const kept = await this.store.stepOf(runId, stepKey)
        return kept?.status === "done" ? (kept.result ?? {}) : undefined
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
        if (decision.approved && decision.by === null) throw this.refused(DECISION_ACTOR_UNKNOWN)
        const answer = this.handlers.of(step.kind)?.onDecided?.(step, decision)
        if (answer !== undefined && answer.kind !== "done")
            throw this.refused(answer.kind === "failed" ? answer.code : "decision_not_ready")
        const verdict = { result: { approved: decision.approved, by: decision.by }, next: [] }
        return this.store.resume(
            tx,
            workItemId,
            answer?.kind === "done" ? { result: answer.result, next: answer.next } : verdict,
        )
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
