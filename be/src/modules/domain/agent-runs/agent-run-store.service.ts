import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { runRecordOf, runViewOf } from "./agent-runs.mapper"
import type { RunRecord } from "./agent-runs-records.contracts"
import { RUN_CANCELLED, SETTLE_TRIES } from "./policies/agent-runs.policy"
import { jsonValueOf } from "./policies/json-value.policy"
import type { RunCancelResult, RunView } from "./agent-runs-engine.contracts"
import type { RunOpen } from "./agent-runs.contracts"

/** What a unit of store work is given: the scope of one workspace. */
type ScopedUse<T> = (tx: ScopedTx) => Promise<T>

const rejected = (): AgentRunsError => new AgentRunsError({ code: AgentRunsErrorCode.ResultRejected })

const iso = (at: Date): string => at.toISOString()

const jsonOr = (value: unknown): JsonValue => {
    const read = jsonValueOf(value)
    if (!read.valid) throw rejected()
    return read.json
}

@Injectable()
/**
 * The runs as the capability opens, reads and cancels them, over the entity engine: one run per wake, the run of a wake, a run by id, and
 * the owner's cancel of a history row. Every method names the workspace: the scope is entered on the caller's transaction (`within`) when
 * one is given, else in a transaction of its own. A write to a run is made under the version it was read at and read again when another
 * writer moved it. The steps of a run are written by the thread projection (agent-threads), never here.
 */
export class AgentRunStoreService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly engine: EntityEngineService,
        private readonly records: AgentRunRecordsService,
    ) {}

    /** Opens the one run of a wake in `tx`; a wake that already has a run answers it, so a replay opens none. */
    open(tx: EntityManager, input: RunOpen): Promise<RunView> {
        return this.at(input.workspaceId, tx, async (scoped) =>
            runViewOf((await this.records.runOfWake(scoped, input.wakeId)) ?? (await this.insertRun(scoped, input))),
        )
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

    /**
     * Stops a run that is running or waiting, once: the run is marked cancelled with who and when, and its steps still running are failed
     * with `run_cancelled` and give back their claim and their wait. Steps already done are left as they are: nothing is undone. Only a
     * history row of the old engine comes here (a thread run is cancelled by its stop's skip).
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

    /** Runs `work` in the scope of the workspace: on `manager` when the caller holds a transaction, else in one of its own. */
    private at<T>(workspaceId: string, manager: EntityManager | undefined, work: ScopedUse<T>): Promise<T> {
        return manager === undefined
            ? this.engine.scoped(workspaceId, work)
            : this.engine.within(manager, workspaceId, work)
    }

    private async insertRun(scoped: ScopedTx, input: RunOpen): Promise<RunRecord> {
        const inserted = await this.records.insertRun(scoped, {
            agentId: input.agentId,
            wakeId: input.wakeId,
            trigger: input.trigger,
            graphVersionId: input.versionId,
            planning: false,
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

    /**
     * Reads the run, asks `build` for what to write, writes it under the version read and, when another writer moved the run first, reads
     * and builds again. Answers the run after the write, or null when `build` answered no write.
     */
    private async patchRunWith(
        scoped: ScopedTx,
        runId: string,
        build: (run: RunRecord) => MutationValues | null,
        left: number = SETTLE_TRIES,
    ): Promise<RunRecord | null> {
        if (left <= 0) throw new AgentRunsError({ code: AgentRunsErrorCode.RunContended })
        const run = await this.records.run(scoped, runId)
        if (run === null) throw rejected()
        const values = build(run)
        if (values === null) return null
        const written = await this.records.patchRun(scoped, run, values)
        return written === null ? this.patchRunWith(scoped, runId, build, left - 1) : written
    }
}
