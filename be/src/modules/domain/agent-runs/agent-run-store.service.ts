import { Injectable } from "@nestjs/common"
import { IsNull, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { handlerViewsOf, routeStepOf, runViewOf, stepViewOf } from "./agent-runs.mapper"
import { filled } from "./policies/agent-runs.policy"
import { parseDue } from "./policies/db-results.policy"
import { AgentRunEntity, AgentRunStepEntity } from "./persistence/entities"
import type { RunDue, RouteMove, RunRef, RunStepView, RunView, WaitAnswer } from "./agent-runs-engine.contracts"
import type { RunOpen, StepSpec, StepView } from "./agent-runs.contracts"
import type { RouteStep } from "./policies/failure-route.policy"

/** One row a database function answered: the value sits under the function's own name. */
type FunctionRow = Readonly<Record<string, unknown>>

/** The most steps one run is read with: a run is a short chain, the budget keeps a bug from reading a table. */
const STEPS_MAX = 200

/** The parameter of a JSON column of a database function: its text, so an array is never read as a Postgres array. */
const jsonText = (value: unknown): string => JSON.stringify(value)

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

@Injectable()
/**
 * The rows of the runs: open the one run of a wake, write steps with the job that drives them, read a run and its steps, move a run to the
 * status a policy chose and answer what the sweep must look at. Every write that touches a step goes through a database function; the
 * back end inserts only the run row.
 */
export class AgentRunStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly queue: AgentStepQueue,
    ) {}

    /** Opens the one run of a wake in `tx`; a wake that already has a run answers it, so a replay opens none. */
    async open(tx: EntityManager, input: RunOpen): Promise<RunView> {
        await tx
            .createQueryBuilder(AgentRunEntity, "r")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                agentId: input.agentId,
                wakeId: input.wakeId,
                trigger: input.trigger,
                versionId: input.versionId,
                context: input.context,
            })
            .orIgnore()
            .execute()
        const run = await tx.findOneByOrFail(AgentRunEntity, { wakeId: input.wakeId })
        return runViewOf(run)
    }

    /** Writes steps behind the last one of the run in `tx`, with no job; a step key already written is left as it is. Answers how many were written. */
    async appendRows(tx: EntityManager, run: RunRef, specs: ReadonlyArray<StepSpec>): Promise<number> {
        if (specs.length === 0) return 0
        const [row] = await callDbFunction<FunctionRow>(tx, "public.agent_run_append", [
            run.runId,
            jsonText(specs.map(filled)),
        ])
        const written = row?.agent_run_append
        if (typeof written !== "number") throw rejected()
        return written
    }

    /** Writes steps behind the last one of the run and the job that drives them, in `tx`: they commit together or not at all. Answers how many were written. */
    async append(tx: EntityManager, run: RunRef, specs: ReadonlyArray<StepSpec>): Promise<number> {
        const written = await this.appendRows(tx, run, specs)
        const first = specs[0]
        if (written > 0 && first !== undefined) {
            await this.queue.enqueueAdvance({ workspaceId: run.workspaceId, runId: run.runId }, first.stepKey, "append", tx)
        }
        return written
    }

    /** The run of a wake, or null. */
    async runOfWake(wakeId: string): Promise<RunView | null> {
        const run = await this.entityManager.findOneBy(AgentRunEntity, { wakeId })
        return run === null ? null : runViewOf(run)
    }

    /** The run, or null. */
    async runById(runId: string): Promise<RunView | null> {
        const run = await this.entityManager.findOneBy(AgentRunEntity, { id: runId })
        return run === null ? null : runViewOf(run)
    }

    /** The run, read through `tx`; a run that is not there is a bug of the caller. */
    async runIn(tx: EntityManager, runId: string): Promise<RunView> {
        return runViewOf(await tx.findOneByOrFail(AgentRunEntity, { id: runId }))
    }

    /** The steps of a run as a handler reads them, in order. */
    async viewsOf(runId: string): Promise<ReadonlyArray<StepView>> {
        const steps = await this.entityManager.find(AgentRunStepEntity, { where: { runId }, order: { seq: "ASC" }, take: STEPS_MAX })
        return handlerViewsOf(steps)
    }

    /** The steps of a run in order, read through `db` (a transaction when the caller routes inside one). */
    async stepsOf(db: EntityManager, runId: string): Promise<ReadonlyArray<RunStepView>> {
        const steps = await db.find(AgentRunStepEntity, { where: { runId }, order: { seq: "ASC" }, take: STEPS_MAX })
        return steps.map(stepViewOf)
    }

    /** The steps of a run as the failure route reads them. */
    async routeStepsOf(db: EntityManager, runId: string): Promise<ReadonlyArray<RouteStep>> {
        return (await this.stepsOf(db, runId)).map(routeStepOf)
    }

    /** One step of a run, or null. */
    async stepOf(runId: string, stepKey: string): Promise<RunStepView | null> {
        const step = await this.entityManager.findOneBy(AgentRunStepEntity, { runId, stepKey })
        return step === null ? null : stepViewOf(step)
    }

    /** The wait steps that are open, the oldest deadline first, at most `limit`. */
    async openWaits(limit: number): Promise<ReadonlyArray<RunStepView>> {
        const steps = await this.entityManager.find(AgentRunStepEntity, {
            where: { status: "running", waitItemId: Not(IsNull()) },
            order: { claimUntil: "ASC" },
            take: limit,
        })
        return steps.map(stepViewOf)
    }

    /** The step that waits on the work item, as its handler reads it, or null when none does. */
    async waitingOn(tx: EntityManager, workItemId: string): Promise<StepView | null> {
        const row = await tx.findOneBy(AgentRunStepEntity, { waitItemId: workItemId, status: "running" })
        if (row === null) return null
        const steps = await tx.find(AgentRunStepEntity, { where: { runId: row.runId }, order: { seq: "ASC" }, take: STEPS_MAX })
        return handlerViewsOf(steps).find((view) => view.stepKey === row.stepKey) ?? null
    }

    /** A person's answer, in the transaction of the decision: finishes the step that waits on the work item and writes the steps that follow. False when none waits on it. */
    async resume(tx: EntityManager, workItemId: string, answer: WaitAnswer): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(tx, "public.agent_step_resume", [
            workItemId,
            jsonText(answer.result),
            answer.next.length > 0,
        ])
        const resumed = row?.agent_step_resume
        if (typeof resumed !== "object" || resumed === null) throw rejected()
        if (!("runId" in resumed) || typeof resumed.runId !== "string") return false
        const run = await tx.findOneByOrFail(AgentRunEntity, { id: resumed.runId })
        await this.appendRows(tx, { runId: run.id, workspaceId: run.workspaceId }, answer.next)
        await this.queue.enqueueAdvance({ workspaceId: run.workspaceId, runId: run.id }, workItemId, "resume", tx)
        return true
    }

    /** Moves the run from the status it was read in to the one a policy chose, once; the named done steps become compensating. False when another path decided first. */
    async route(db: EntityManager, runId: string, move: RouteMove): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(db, "public.agent_run_route", [
            runId,
            move.from,
            move.to,
            move.code,
            move.compensate,
        ])
        return row?.agent_run_route === true
    }

    /** Marks that a person was told; true for the first mark only. */
    async spoken(runId: string): Promise<boolean> {
        const [row] = await callDbFunction<FunctionRow>(this.entityManager, "public.agent_run_spoken", [runId])
        return row?.agent_run_spoken === true
    }

    /** What the sweep must look at, at most `limit` of each kind. */
    async due(limit: number): Promise<ReadonlyArray<RunDue>> {
        const rows = await callDbFunction<unknown>(this.entityManager, "public.agent_run_due", [limit])
        const due = parseDue(rows)
        if (due === null) throw rejected()
        return due
    }
}
