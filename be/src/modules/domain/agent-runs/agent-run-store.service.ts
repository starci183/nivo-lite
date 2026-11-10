import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunReportService } from "./agent-run-report.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { handlerViewOf, handlerViewsOf, routeStepOf, runRecordOf, runViewOf, stepViewOf } from "./agent-runs.mapper"
import type { RunRecord } from "./agent-runs-records.contracts"
import { RUN_CANCELLED, SETTLE_TRIES, STEPS_MAX, TELL_STATUSES, filled } from "./policies/agent-runs.policy"
import { jsonValueOf } from "./policies/json-value.policy"
import { planBindingVerdict } from "./policies/plan-binding.policy"
import { CLOSED_RUN, statusAfter } from "./policies/run-status.policy"
import type { RouteMove, RunCancelResult, RunRef, RunStepView, RunView, WaitAnswer } from "./agent-runs-engine.contracts"
import type { RunOpen, StepLink, StepSpec, StepView } from "./agent-runs.contracts"
import type { RouteStep } from "./policies/failure-route.policy"

/** What a unit of engine work is given: the scope of one workspace. */
export type ScopedUse<T> = (tx: ScopedTx) => Promise<T>

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

const iso = (at: Date): string => at.toISOString()

const jsonOr = (value: unknown): JsonValue => {
    const read = jsonValueOf(value)
    if (!read.valid) throw rejected()
    return read.json
}

@Injectable()
/**
 * The runs and their steps as the capability reads and writes them, over the entity engine. Every method names the workspace: the scope is
 * entered on the caller's transaction (`within`) when one is given, else in a transaction of its own. A write to a run is made under the
 * version it was read at and read again when another writer moved it, so the run's version is where every writer is serialized.
 */
export class AgentRunStoreService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly records: AgentRunRecordsService,
        private readonly queue: AgentStepQueue,
        private readonly report: AgentRunReportService,
    ) {}

    /** Runs `work` in the scope of the workspace: on `manager` when the caller holds a transaction, else in one of its own. */
    at<T>(workspaceId: string, manager: EntityManager | undefined, work: ScopedUse<T>): Promise<T> {
        return manager === undefined
            ? this.engine.scoped(workspaceId, work)
            : this.engine.within(manager, workspaceId, work)
    }

    /** Opens the one run of a wake in `tx`; a wake that already has a run answers it, so a replay opens none. */
    open(tx: EntityManager, input: RunOpen): Promise<RunView> {
        return this.at(input.workspaceId, tx, async (scoped) => runViewOf(await this.openIn(scoped, input)))
    }

    private async openIn(scoped: ScopedTx, input: RunOpen): Promise<RunRecord> {
        const existing = await this.records.runOfWake(scoped, input.wakeId)
        const run = existing ?? (await this.insertRun(scoped, input))
        if (input.planning !== true) return run
        const verdict = planBindingVerdict({
            binding: "planBinding" in run.context ? run.context.planBinding : undefined,
            graphVersionId: run.graphVersionId,
            versionId: input.versionId,
            trigger: input.trigger,
        })
        if (verdict === "conflict") throw new AgentRunsError({ code: AgentRunsErrorCode.PlanConflict })
        if (verdict === "bound") return run
        if (run.stepSeq > 0 || (await this.records.stepsOf(scoped, run.id)).length > 0)
            throw new AgentRunsError({ code: AgentRunsErrorCode.PlanConflict })
        const context = {
            ...run.context,
            planBinding: { versionId: input.versionId, trigger: input.trigger, context: input.context },
        }
        const bound = await this.records.patchRun(scoped, run, {
            graphVersionId: input.versionId,
            planning: true,
            context: jsonOr(context),
        })
        if (bound === null) throw new AgentRunsError({ code: AgentRunsErrorCode.RunContended })
        return bound
    }

    private async insertRun(scoped: ScopedTx, input: RunOpen): Promise<RunRecord> {
        const inserted = await this.records.insertRun(scoped, {
            agentId: input.agentId,
            wakeId: input.wakeId,
            trigger: input.trigger,
            graphVersionId: input.versionId,
            planning: input.planning === true,
            status: "running",
            context: jsonOr(input.context),
            resumeAttempts: 0,
            stepSeq: 0,
            startedAt: iso(this.clock.now()),
        })
        if (inserted.ok) return runRecordOf(inserted.row)
        if (inserted.reason !== "taken") throw rejected()
        const raced = await this.records.runOfWake(scoped, input.wakeId)
        if (raced === null) throw rejected()
        return raced
    }

    private async runOf(scoped: ScopedTx, runId: string): Promise<RunRecord> {
        const run = await this.records.run(scoped, runId)
        if (run === null) throw rejected()
        return run
    }

    /** Writes steps behind the last one of the run in `tx`, with no job; a step key already written is left as it is. Answers how many were written. */
    appendRows(tx: EntityManager, run: RunRef, specs: ReadonlyArray<StepSpec>): Promise<number> {
        if (specs.length === 0) return Promise.resolve(0)
        return this.at(run.workspaceId, tx, (scoped) => this.appendIn(scoped, run.runId, specs))
    }

    /** Writes steps behind the last one of the run and the job that drives them, in `tx`: they commit together or not at all. Answers how many were written. */
    async append(tx: EntityManager, run: RunRef, specs: ReadonlyArray<StepSpec>): Promise<number> {
        const written = await this.appendRows(tx, run, specs)
        const first = specs[0]
        if (written > 0 && first !== undefined) {
            await this.queue.enqueueAdvance(
                { workspaceId: run.workspaceId, runId: run.runId },
                first.stepKey,
                "append",
                tx,
            )
        }
        return written
    }

    /**
     * Reserves the ordinals of the steps not yet written by raising the run's counter under its version, then writes them. A run that has
     * ended takes none. A replayed spec is skipped before the counter moves, and a race on a step key is skipped by the unique constraint.
     */
    async appendIn(scoped: ScopedTx, runId: string, specs: ReadonlyArray<StepSpec>): Promise<number> {
        const existing = new Set((await this.records.stepsOf(scoped, runId)).map((step) => step.stepKey))
        const fresh = specs.filter((spec) => !existing.has(spec.stepKey))
        if (fresh.length === 0) return 0
        const base = await this.reserve(scoped, runId, fresh.length)
        if (base === null) return 0
        const now = this.clock.now()
        const written: Array<boolean> = []
        await eachInOrder(fresh, async (spec, index) => {
            const full = filled(spec)
            const input = jsonOr(full.input)
            const link = typeof full.input.workItemId === "string" ? { workItemId: full.input.workItemId } : {}
            const inserted = await this.records.insertStep(scoped, runId, {
                ordinal: base + index + 1,
                stepKey: full.stepKey,
                nodeKey: full.nodeKey,
                kind: full.kind,
                effect: jsonOr(full.effect),
                input,
                status: "pending",
                attempt: 0,
                maxAttempts: full.maxAttempts,
                deadlineMs: full.deadlineMs,
                notBefore: iso(now),
                compAttempts: 0,
                doorCalls: { calls: [] },
                ...link,
            })
            if (!inserted.ok && inserted.reason !== "taken") throw rejected()
            written.push(inserted.ok)
        })
        return written.filter(Boolean).length
    }

    /** Raises the step counter of an open run by `count`, waking a waiting run; the counter before, or null when the run takes no step. */
    private async reserve(scoped: ScopedTx, runId: string, count: number): Promise<number | null> {
        const reserved = await this.patchRunWith(scoped, runId, (run) => {
            if (CLOSED_RUN.includes(run.status)) return null
            if (run.stepSeq + count > STEPS_MAX) throw new AgentRunsError({ code: AgentRunsErrorCode.RunTooLong })
            return { stepSeq: run.stepSeq + count, ...(run.status === "waiting" ? { status: "running" } : {}) }
        })
        return reserved === null ? null : reserved.stepSeq - count
    }

    /**
     * Reads the run, asks `build` for what to write, writes it under the version read and, when another writer moved the run first, reads
     * and builds again. Answers the run after the write, or null when `build` answered no write.
     */
    async patchRunWith(
        scoped: ScopedTx,
        runId: string,
        build: (run: RunRecord) => MutationValues | null | Promise<MutationValues | null>,
        left: number = SETTLE_TRIES,
    ): Promise<RunRecord | null> {
        if (left <= 0) throw new AgentRunsError({ code: AgentRunsErrorCode.RunContended })
        const run = await this.runOf(scoped, runId)
        const values = await build(run)
        if (values === null) return null
        const written = await this.records.patchRun(scoped, run, values)
        if (written === null) return this.patchRunWith(scoped, runId, build, left - 1)
        if (written.status === "done" && run.status !== "done")
            await this.report.ended(scoped.manager, scoped.workspaceId, written)
        return written
    }

    /** Writes the run's status after a step changed: the steps are read after the run, so a racing commit is seen on the next try. */
    settleIn(scoped: ScopedTx, runId: string, more: boolean): Promise<RunRecord | null> {
        return this.patchRunWith(scoped, runId, async (run) => {
            const steps = await this.records.stepsOf(scoped, runId)
            if (run.status !== "running" && run.status !== "waiting") return { stepSeq: run.stepSeq }
            const status = statusAfter(steps, more)
            return status === "done" ? { status, endedAt: iso(this.clock.now()) } : { status }
        })
    }

    /** The run of a wake, or null; a producer reads it through the transaction that writes its work. */
    async runOfWake(workspaceId: string, wakeId: string, manager?: EntityManager): Promise<RunView | null> {
        const run = await this.at(workspaceId, manager, (scoped) => this.records.runOfWake(scoped, wakeId))
        return run === null ? null : runViewOf(run)
    }

    /** The run, or null. */
    async runById(workspaceId: string, runId: string, manager?: EntityManager): Promise<RunView | null> {
        const run = await this.at(workspaceId, manager, (scoped) => this.records.run(scoped, runId))
        return run === null ? null : runViewOf(run)
    }

    /** The run, read through `tx`; a run that is not there is a bug of the caller. */
    async runIn(tx: EntityManager, workspaceId: string, runId: string): Promise<RunView> {
        return runViewOf(await this.at(workspaceId, tx, (scoped) => this.runOf(scoped, runId)))
    }

    /** The steps of a run as a handler reads them, in order. */
    viewsOf(workspaceId: string, runId: string, manager?: EntityManager): Promise<ReadonlyArray<StepView>> {
        return this.at(workspaceId, manager, (scoped) => this.viewsIn(scoped, runId))
    }

    /** The steps of a run as a handler reads them, in the scope in hand. */
    async viewsIn(scoped: ScopedTx, runId: string): Promise<ReadonlyArray<StepView>> {
        const run = await this.records.run(scoped, runId)
        if (run === null) return []
        return handlerViewsOf(run, await this.records.stepsOf(scoped, runId))
    }

    /** The steps of a run in order, read through `manager` when the caller routes inside a transaction. */
    stepsOf(workspaceId: string, runId: string, manager?: EntityManager): Promise<ReadonlyArray<RunStepView>> {
        return this.at(workspaceId, manager, async (scoped) =>
            (await this.records.stepsOf(scoped, runId)).map(stepViewOf),
        )
    }

    /** The steps of a run as the failure route reads them. */
    async routeStepsOf(workspaceId: string, runId: string, manager?: EntityManager): Promise<ReadonlyArray<RouteStep>> {
        return (await this.stepsOf(workspaceId, runId, manager)).map(routeStepOf)
    }

    /** One step of a run, or null. */
    async stepOf(
        workspaceId: string,
        runId: string,
        stepKey: string,
        manager?: EntityManager,
    ): Promise<RunStepView | null> {
        const steps = await this.stepsOf(workspaceId, runId, manager)
        return steps.find((step) => step.stepKey === stepKey) ?? null
    }

    /** The wait steps that are open in the workspace, the oldest deadline first, at most `limit`. */
    openWaits(workspaceId: string, limit: number): Promise<ReadonlyArray<RunStepView>> {
        return this.at(workspaceId, undefined, async (scoped) => {
            const steps = await this.records.stepsOfStatus(
                scoped,
                "running",
                { op: "notNull", field: "waitItemId" },
                [
                    ["claimedUntil", "asc"],
                    ["id", "asc"],
                ],
                limit,
            )
            return steps.map(stepViewOf)
        })
    }

    /** At most two links for a consumer's immutable input key; two lets the consumer refuse an ambiguous association. Only `workItemId` is kept. */
    linksFor(workspaceId: string, kind: string, key: string, value: string): Promise<ReadonlyArray<StepLink>> {
        if (key !== "workItemId")
            return Promise.reject(new AgentRunsError({ code: AgentRunsErrorCode.LinkKeyUnsupported, params: { key } }))
        return this.at(workspaceId, undefined, async (scoped) => {
            const steps = await this.records.stepsAbout(scoped, kind, value, 2)
            return Promise.all(
                steps.map(async (step) => ({
                    kind: step.kind,
                    agentId: (await this.runOf(scoped, step.runId)).agentId,
                    status: step.status,
                    waitItemId: step.waitItemId,
                    input: step.input,
                })),
            )
        })
    }

    /** The step that waits on the work item, as its handler reads it, or null when none does. */
    waitingOn(workspaceId: string, workItemId: string, manager?: EntityManager): Promise<StepView | null> {
        return this.at(workspaceId, manager, (scoped) => this.waitingIn(scoped, workItemId))
    }

    private async waitingIn(scoped: ScopedTx, workItemId: string): Promise<StepView | null> {
        const waiting = (await this.records.stepsWaitingOn(scoped, workItemId)).find(
            (step) => step.status === "running",
        )
        if (waiting === undefined) return null
        const run = await this.runOf(scoped, waiting.runId)
        const steps = await this.records.stepsOf(scoped, waiting.runId)
        return handlerViewOf(run, steps, waiting)
    }

    /**
     * A person's answer, in the transaction of the decision: finishes the step that waits on the work item under its version (the bump ends
     * the claim of the handler that began the wait), writes the steps that follow and the job that drives them. False when none waits on it.
     */
    async resume(tx: EntityManager, workspaceId: string, workItemId: string, answer: WaitAnswer): Promise<boolean> {
        const runId = await this.at(workspaceId, tx, async (scoped) => {
            const step = (await this.records.stepsWaitingOn(scoped, workItemId)).find((s) => s.status === "running")
            if (step === undefined) return null
            const done = await this.records.patchStep(scoped, step, {
                status: "done",
                result: jsonOr(answer.result),
                errorCode: null,
                claimedUntil: null,
                waitItemId: null,
                endedAt: iso(this.clock.now()),
            })
            if (done === null) return null
            await this.appendIn(scoped, step.runId, answer.next)
            await this.settleIn(scoped, step.runId, answer.next.length > 0)
            return step.runId
        })
        if (runId === null) return false
        await this.queue.enqueueAdvance({ workspaceId, runId }, workItemId, "resume", tx)
        return true
    }

    /** Moves the run from the status it was read in to the one a policy chose, once; the named done steps become compensating. False when another path decided first. */
    route(workspaceId: string, runId: string, move: RouteMove, manager?: EntityManager): Promise<boolean> {
        return this.at(workspaceId, manager, async (scoped) => {
            const moved = await this.patchRunWith(scoped, runId, (run) =>
                run.status === move.from
                    ? {
                          status: move.to,
                          error: { code: move.code },
                          ...(move.to === "parked" ? { parkReason: move.code } : {}),
                          ...(move.to === "dead" || move.to === "failed" || move.to === "parked"
                              ? { endedAt: iso(this.clock.now()) }
                              : {}),
                      }
                    : null,
            )
            if (moved === null) return false
            const steps = await this.records.stepsOf(scoped, runId)
            await eachInOrder(
                steps.filter((step) => step.status === "done" && move.compensate.includes(step.stepKey)),
                async (step) => {
                    await this.records.patchStep(scoped, step, { status: "compensating", claimedUntil: null })
                },
            )
            return true
        })
    }

    /**
     * Stops a run that is queued, running or waiting, once: the run is marked cancelled with who and when, the steps that were claimed or
     * waiting are failed with `run_cancelled` and give back their claim, their wait and their timer, so a worker holding one reads `fenced`
     * and a late decision on its item finds no waiting step. Steps already done are left as they are: nothing is undone.
     */
    cancel(workspaceId: string, runId: string, actor: string, manager?: EntityManager): Promise<RunCancelResult> {
        return this.at(workspaceId, manager, async (scoped): Promise<RunCancelResult> => {
            const current = await this.records.run(scoped, runId)
            if (current === null) return { kind: "not_found" }
            if (current.status === "cancelled") return { kind: "already_cancelled" }
            const at = iso(this.clock.now())
            const moved = await this.patchRunWith(scoped, runId, (run) =>
                run.status === "running" || run.status === "waiting"
                    ? {
                          status: "cancelled",
                          error: { code: RUN_CANCELLED },
                          cancelledBy: actor,
                          cancelledAt: at,
                          endedAt: at,
                          waitWorkItemId: null,
                          waitDeadlineAt: null,
                      }
                    : null,
            )
            if (moved === null) return { kind: "not_cancellable" }
            const steps = await this.records.stepsOf(scoped, runId)
            await eachInOrder(
                steps.filter((step) => step.status === "running"),
                async (step) => {
                    await this.records.patchStep(scoped, step, {
                        status: "failed",
                        errorCode: RUN_CANCELLED,
                        claimedUntil: null,
                        waitItemId: null,
                        endedAt: at,
                    })
                },
            )
            return { kind: "cancelled" }
        })
    }

    /** Marks that a person was told; true for the first mark only. */
    spoken(workspaceId: string, runId: string): Promise<boolean> {
        return this.at(workspaceId, undefined, async (scoped) => {
            const marked = await this.patchRunWith(scoped, runId, (run) =>
                run.deadLetteredAt === null && TELL_STATUSES.includes(run.status)
                    ? { deadLetteredAt: iso(this.clock.now()) }
                    : null,
            )
            return marked !== null
        })
    }
}
