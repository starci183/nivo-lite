import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import {
    COMPENSATION_ATTEMPTS,
    COMPENSATION_LEASE_SECONDS,
    COMPENSATION_RETRY_SECONDS,
} from "./policies/agent-runs.policy"
import { commitParameters } from "./policies/commit-params.policy"
import {
    parseClaim,
    parseCommit,
    parseCompensationClaim,
    parseCompensationCommit,
} from "./policies/db-results.policy"
import type { StepView } from "./agent-runs.contracts"
import type {
    ClaimResult,
    CommitResult,
    CompensationClaim,
    CompensationCommit,
    StepCommit,
} from "./agent-runs-engine.contracts"

/** One row a database function answered: the value sits under the function's own name. */
type FunctionRow = Readonly<Record<string, unknown>>

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

@Injectable()
/**
 * The claim and the commit of a step. A claim takes the step under a new fence; a commit writes what the step did under that fence, so a
 * worker that lost its claim changes nothing. The state change, the steps that follow and the outbox job of the next advance are written in
 * one transaction: they all happen or none does.
 */
export class AgentStepLedgerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: AgentStepQueue,
        private readonly store: AgentRunStoreService,
    ) {}

    /** Claims a step of the run under a new fence: the named one, or the first still open. */
    async claim(runId: string, stepKey: string | null): Promise<ClaimResult> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_step_claim", [runId, stepKey])
        const claim = parseClaim(row?.agent_step_claim)
        if (claim === null) throw rejected()
        return claim
    }

    /** Commits what the step did in a transaction of its own. */
    commit(step: StepView, commit: StepCommit): Promise<CommitResult> {
        return this.entityManager.transaction((tx) => this.commitIn(tx, step, commit))
    }

    /**
     * Commits what the step did in `tx`, under the fence of its claim. A fence that moved on changes nothing: no state, no next step, no job.
     * A finished step writes the steps that follow and the job that drives them; a retried step writes the job that tries it again.
     */
    async commitIn(tx: EntityManager, step: StepView, commit: StepCommit): Promise<CommitResult> {
        const [row] = await callDbFunction<FunctionRow>(tx, "public.agent_step_commit", commitParameters(step, commit))
        const result = parseCommit(row?.agent_step_commit)
        if (result === null) throw rejected()
        if (result === "fenced") return result
        const ref = { runId: step.runId, workspaceId: step.workspaceId }
        if (commit.kind === "done") {
            await this.store.appendRows(tx, ref, commit.next)
            await this.queue.enqueueAdvance(ref, step.stepKey, "done", tx)
        }
        if (commit.kind === "retry") {
            await this.queue.enqueueAdvance(ref, step.stepKey, `retry-${String(step.attempt)}`, tx)
        }
        return result
    }

    /** Gives the claim of a step back at once; false when the claim already moved on. */
    async release(step: StepView): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_step_release", [
            step.runId,
            step.stepKey,
            step.fence,
        ])
        return row?.agent_step_release === true
    }

    /** Claims the last step still to be undone, in the reverse order of the work. */
    async claimCompensation(runId: string): Promise<CompensationClaim> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_comp_claim", [
            runId,
            COMPENSATION_LEASE_SECONDS,
        ])
        const claim = parseCompensationClaim(row?.agent_comp_claim)
        if (claim === null) throw rejected()
        return claim
    }

    /** Commits an undo under the fence of its claim: done, or failed for another try, or dead when the tries are spent. */
    async commitCompensation(step: StepView, ok: boolean, code: string | null): Promise<CompensationCommit> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_comp_commit", [
            step.runId,
            step.stepKey,
            step.fence,
            ok,
            code,
            COMPENSATION_RETRY_SECONDS,
            COMPENSATION_ATTEMPTS,
        ])
        const result = parseCompensationCommit(row?.agent_comp_commit)
        if (result === null) throw rejected()
        return result
    }
}
