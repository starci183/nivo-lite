import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { handlerViewOf } from "./agent-runs.mapper"
import type { RunRecord, StepRecord } from "./agent-runs-records.contracts"
import {
    COMPENSATION_ATTEMPTS,
    COMPENSATION_LEASE_SECONDS,
    COMPENSATION_RETRY_SECONDS,
    secondsOf,
} from "./policies/agent-runs.policy"
import { jsonValueOf } from "./policies/json-value.policy"
import { CLOSED_RUN } from "./policies/run-status.policy"
import type { StepJson, StepView } from "./agent-runs.contracts"
import type {
    ClaimResult,
    CommitResult,
    CompensationClaim,
    CompensationCommit,
    RunRef,
    StepCommit,
} from "./agent-runs-engine.contracts"

const MS = 1000

const iso = (at: Date): string => at.toISOString()

const msOf = (at: Date | null): number => (at === null ? 0 : at.getTime())

/** A step is open when a claim may take it: not started, tried again, or running with no wait. */
const open = (step: StepRecord): boolean =>
    step.status === "pending" || step.status === "failed" || (step.status === "running" && step.waitItemId === null)

@Injectable()
/**
 * The claim and the commit of a step. A claim takes the step under a new fence, which is the record version its update returned; a commit
 * writes what the step did under that fence, so a worker that lost its claim reads `stale` and changes nothing. The state change, the
 * run's new status, the steps that follow and the outbox job of the next advance are written in one transaction.
 */
export class AgentStepLedgerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: AgentStepQueue,
        private readonly store: AgentRunStoreService,
        private readonly records: AgentRunRecordsService,
    ) {}

    /** Claims a step of the run under a new fence: the named one, or the first still open. */
    claim(run: RunRef, stepKey: string | null): Promise<ClaimResult> {
        return this.claimIn(this.entityManager, run, stepKey)
    }

    /** Claims a step inside the transaction that registers its wait with the work item it holds. */
    claimIn(tx: EntityManager, ref: RunRef, stepKey: string | null): Promise<ClaimResult> {
        return this.store.at(ref.workspaceId, tx, (scoped) => this.claimScoped(scoped, ref.runId, stepKey))
    }

    private async claimScoped(scoped: ScopedTx, runId: string, stepKey: string | null): Promise<ClaimResult> {
        const run = await this.records.run(scoped, runId)
        if (run === null) return { kind: "gone" }
        if (CLOSED_RUN.includes(run.status)) return { kind: "closed" }
        const steps = await this.records.stepsOf(scoped, runId)
        const step = stepKey === null ? steps.find(open) : steps.find((candidate) => candidate.stepKey === stepKey)
        if (step === undefined) return { kind: stepKey === null ? "idle" : "gone" }
        const now = this.clock.now()
        const view = (record: StepRecord): StepView =>
            handlerViewOf(
                run,
                steps.map((other) => (other.id === record.id ? record : other)),
                record,
            )
        const early = this.beforeClaim(step, now, view(step))
        if (early !== null) return early
        const claimed = await this.records.patchStep(scoped, step, {
            status: "running",
            attempt: step.attempt + 1,
            claimedUntil: iso(new Date(now.getTime() + step.deadlineMs)),
            startedAt: iso(now),
        })
        if (claimed === null) return { kind: "busy" }
        await this.wake(scoped, run)
        return { kind: "claimed", step: view(claimed) }
    }

    /** What a claim answers without taking the step, or null when the step may be taken. */
    private beforeClaim(step: StepRecord, now: Date, seen: StepView): ClaimResult | null {
        if (step.status === "done") return { kind: "done", answer: step.result }
        if (step.status === "failed" || step.status === "compensating" || step.status === "compensated")
            return { kind: "closed" }
        if (step.status === "running" && msOf(step.claimedUntil) > now.getTime()) return { kind: "busy" }
        if (step.status === "running" && step.waitItemId !== null) return { kind: "waiting_expired", step: seen }
        if (step.status === "pending" && msOf(step.notBefore) > now.getTime())
            return {
                kind: "later",
                retryAfterMs: Math.ceil((msOf(step.notBefore) - now.getTime()) / MS) * MS,
            }
        if (step.attempt >= step.maxAttempts) return { kind: "exhausted", step: seen }
        return null
    }

    /** A claim puts a waiting run back to running; losing the race to another writer leaves the next settle to say it. */
    private async wake(scoped: ScopedTx, run: RunRecord): Promise<void> {
        if (run.status === "waiting") await this.records.patchRun(scoped, run, { status: "running" })
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
        const ref = { runId: step.runId, workspaceId: step.workspaceId }
        const result = await this.store.at(step.workspaceId, tx, (scoped) => this.commitScoped(scoped, step, commit))
        if (result === "ok") await this.followUp(tx, ref, step, commit)
        return result
    }

    private async followUp(tx: EntityManager, ref: RunRef, step: StepView, commit: StepCommit): Promise<void> {
        if (commit.kind === "done") {
            await this.queue.enqueueAdvance(ref, step.stepKey, "done", tx)
        }
        if (commit.kind === "retry") {
            await this.queue.enqueueAdvance(ref, step.stepKey, `retry-${String(step.attempt)}`, tx)
        }
    }

    private async commitScoped(scoped: ScopedTx, step: StepView, commit: StepCommit): Promise<CommitResult> {
        const run = await this.records.run(scoped, step.runId)
        const current = (await this.records.stepsOf(scoped, step.runId)).find((s) => s.stepKey === step.stepKey)
        if (run === null || current === undefined) return "fenced"
        if (Number(current.version) !== step.fence || current.status !== "running") return "fenced"
        const written = await this.records.patchStep(scoped, current, this.outcomeOf(commit))
        if (written === null) return "fenced"
        const appended = commit.kind === "done" ? await this.store.appendIn(scoped, step.runId, commit.next) : 0
        await this.store.patchRunWith(scoped, step.runId, async (fresh) => {
            const steps = await this.records.stepsOf(scoped, step.runId)
            return this.runValues(fresh, steps, commit, appended)
        })
        return "ok"
    }

    private outcomeOf(commit: StepCommit): MutationValues {
        const now = this.clock.now()
        if (commit.kind === "done")
            return {
                status: "done",
                result: this.jsonOf(commit.result),
                errorCode: null,
                claimedUntil: null,
                waitItemId: null,
                endedAt: iso(now),
            }
        if (commit.kind === "wait")
            return {
                waitItemId: commit.workItemId,
                workItemId: commit.workItemId,
                claimedUntil: iso(commit.deadlineAt),
            }
        if (commit.kind === "retry")
            return {
                status: "pending",
                errorCode: commit.code,
                claimedUntil: null,
                waitItemId: null,
                notBefore: iso(new Date(now.getTime() + secondsOf(commit.afterMs) * MS)),
            }
        return { status: "failed", errorCode: commit.code, claimedUntil: null, waitItemId: null }
    }

    private jsonOf(value: StepJson): MutationValues[string] {
        const read = jsonValueOf(value)
        return read.valid ? read.json : {}
    }

    /** What a commit writes to the run: its status after the step, read against the steps as they stand. */
    /**
     * The run's status after a commit, read from the steps after the next ones were appended: a next step that was already written (a
     * replay) adds nothing, so a run whose steps are all done ends even when the finished step named it again.
     */
    private runValues(
        run: RunRecord,
        steps: ReadonlyArray<StepRecord>,
        commit: StepCommit,
        appended: number,
    ): MutationValues {
        if (run.status !== "running" && run.status !== "waiting") return { stepSeq: run.stepSeq }
        if (commit.kind === "retry" || commit.kind === "failed") return { status: "running" }
        const more = commit.kind === "done" && (commit.continues === true || appended > 0)
        if (more) return { status: "running" }
        if (steps.every((step) => step.status === "done")) return { status: "done", endedAt: iso(this.clock.now()) }
        return { status: steps.some(open) ? "running" : "waiting" }
    }

    /** Gives the claim of a step back at once; false when the claim already moved on. */
    release(step: StepView): Promise<boolean> {
        return this.store.at(step.workspaceId, undefined, async (scoped) => {
            const current = (await this.records.stepsOf(scoped, step.runId)).find((s) => s.stepKey === step.stepKey)
            if (current === undefined) return false
            if (Number(current.version) !== step.fence || current.status !== "running" || current.waitItemId !== null)
                return false
            const released = await this.records.patchStep(scoped, current, {
                claimedUntil: iso(new Date(this.clock.now().getTime() - MS)),
            })
            return released !== null
        })
    }

    /** Claims the last step still to be undone, in the reverse order of the work. */
    claimCompensation(ref: RunRef): Promise<CompensationClaim> {
        return this.store.at(ref.workspaceId, undefined, async (scoped) => {
            const run = await this.records.run(scoped, ref.runId)
            if (run?.status !== "compensating") return { kind: "closed" }
            const steps = await this.records.stepsOf(scoped, ref.runId)
            const step = steps.findLast((candidate) => candidate.status === "compensating")
            const now = this.clock.now()
            if (step === undefined) {
                await this.store.patchRunWith(scoped, ref.runId, (fresh) =>
                    fresh.status === "compensating" ? { status: "compensated", endedAt: iso(now) } : null,
                )
                return { kind: "finished" }
            }
            if (msOf(step.claimedUntil) > now.getTime()) return { kind: "busy" }
            const claimed = await this.records.patchStep(scoped, step, {
                claimedUntil: iso(new Date(now.getTime() + COMPENSATION_LEASE_SECONDS * MS)),
            })
            if (claimed === null) return { kind: "busy" }
            return {
                kind: "claimed",
                step: handlerViewOf(
                    run,
                    steps.map((other) => (other.id === claimed.id ? claimed : other)),
                    claimed,
                ),
            }
        })
    }

    /** Commits an undo under the fence of its claim: done, or failed for another try, or dead when the tries are spent. */
    commitCompensation(step: StepView, ok: boolean, code: string | null): Promise<CompensationCommit> {
        return this.store.at(step.workspaceId, undefined, async (scoped) => {
            const current = (await this.records.stepsOf(scoped, step.runId)).find((s) => s.stepKey === step.stepKey)
            if (current === undefined) return "fenced"
            if (Number(current.version) !== step.fence || current.status !== "compensating") return "fenced"
            if (ok) {
                const undone = await this.records.patchStep(scoped, current, {
                    status: "compensated",
                    claimedUntil: null,
                    errorCode: null,
                })
                return undone === null ? "fenced" : "ok"
            }
            const retried = await this.records.patchStep(scoped, current, {
                compAttempts: current.compAttempts + 1,
                errorCode: code,
                claimedUntil: iso(new Date(this.clock.now().getTime() + COMPENSATION_RETRY_SECONDS * MS)),
            })
            if (retried === null) return "fenced"
            if (current.compAttempts + 1 < COMPENSATION_ATTEMPTS) return "ok"
            await this.store.patchRunWith(scoped, step.runId, () => ({
                status: "dead",
                error: { code: "compensation_failed" },
                endedAt: iso(this.clock.now()),
            }))
            return "dead"
        })
    }
}
