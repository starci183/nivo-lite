import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsError, AgentRunsErrorCode } from "./errors/agent-runs.error"
import { stepViewOf } from "./agent-runs.mapper"
import type { RunRecord } from "./agent-runs-records.contracts"
import { jsonValueOf } from "./policies/json-value.policy"
import { isOldEngineRun } from "./policies/run-engine.policy"
import { parkAgeSeconds, resumeGapSeconds, servesCustomer, supersededBy } from "./policies/park-ladder.policy"
import { RESUMABLE_RUN, UNDONE_STEP } from "./policies/run-status.policy"
import { subjectOfRun } from "./policies/run-subject.policy"
import type {
    OptionalFailedStep,
    OptionalRunStanding,
    ParkedFacts,
    ParkedQuery,
    ParkedRef,
    ResumeAnswer,
    ResumeWrite,
} from "./agent-runs-engine.contracts"

/** The most parked runs one read looks at before the filters that need their steps cut it to the pass limit. */
const CANDIDATES_MAX = 100

/** The most of the agent's newest finished runs a parked chat run is checked against. */
const SUPERSEDE_LOOKBACK = 20

/** Why a parked run the machine will not resume was closed: a newer run already answered its conversation. */
export const SUPERSEDED = "superseded"

const MS = 1000

@Injectable()
/**
 * The runs that stopped for a fix: note the build a run parked under, read the step it stopped on, list the parked runs a machine may
 * try again, and put one back on that step. The reset and the job that drives it commit together; every write is an engine update under
 * the version read.
 */
export class AgentRunParkStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly store: AgentRunStoreService,
        private readonly records: AgentRunRecordsService,
        private readonly queue: AgentStepQueue,
    ) {}

    /** The first failed step of a run, or null when none failed. */
    async failedStepOf(workspaceId: string, runId: string): Promise<OptionalFailedStep> {
        const steps = await this.store.stepsOf(workspaceId, runId)
        return steps.find((step) => step.status === "failed") ?? null
    }

    /** Records the build a run parked under; false when the run is not parked. */
    markParked(workspaceId: string, runId: string, build: string): Promise<boolean> {
        return this.store.at(workspaceId, undefined, async (scoped) => {
            const marked = await this.store.patchRunWith(scoped, runId, (run) =>
                run.status === "parked" ? { parkedBuild: build } : null,
            )
            return marked !== null
        })
    }

    /**
     * Puts a run that stopped on a failed step (parked, failed after its tries, or dead) back on that step with a fresh budget of tries and
     * writes the job that drives it, in one transaction: the job exists exactly when the reset does. The job's key is the version of the failed
     * step the request read, so one request is one job: a second request finds the step already moved and the run running, and does nothing. `input` replaces the failed step's input when a handler re-read it; `auto` bounds the tries of the machine by `max`.
     */
    resumeRun(request: ResumeWrite): Promise<ResumeAnswer> {
        return this.entityManager.transaction(async (tx) => {
            const answer = await this.store.at(request.workspaceId, tx, (scoped) => this.resumeIn(scoped, request))
            if (answer.kind === "resumed") {
                await this.queue.enqueueAdvance(
                    { workspaceId: answer.workspaceId, runId: request.runId },
                    answer.stepKey,
                    answer.effectKey,
                    tx,
                )
            }
            return answer
        })
    }

    private async resumeIn(scoped: ScopedTx, request: ResumeWrite): Promise<ResumeAnswer> {
        const run = await this.records.run(scoped, request.runId)
        if (run === null) return { kind: "not_found" }
        // A run on a LangGraph thread is never put back on a projected step: only its stop moves it.
        if (!isOldEngineRun(run)) return { kind: "not_parked" }
        if (run.status === "compensated" || run.status === "compensating") return { kind: "compensated" }
        if (!RESUMABLE_RUN.includes(run.status)) return { kind: "not_parked" }
        const steps = await this.records.stepsOf(scoped, request.runId)
        if (steps.some((step) => UNDONE_STEP.includes(step.status))) return { kind: "compensated" }
        const failed = steps.find((step) => step.status === "failed")
        if (failed === undefined) return { kind: "no_failed_step" }
        if (request.auto && run.resumeAttempts >= request.max) return { kind: "exhausted" }
        if (request.auto && (await this.superseded(scoped, run))) return this.closeSuperseded(scoped, run)
        const now = this.clock.now()
        const read = request.input === undefined ? null : jsonValueOf(request.input)
        const input = read?.valid === true ? read.json : undefined
        const reset = await this.records.patchStep(scoped, failed, {
            status: "pending",
            attempt: 0,
            errorCode: null,
            claimedUntil: null,
            waitItemId: null,
            notBefore: now.toISOString(),
            ...(input === undefined ? {} : { input }),
        })
        if (reset === null) throw new AgentRunsError({ code: AgentRunsErrorCode.RunContended })
        await this.store.patchRunWith(scoped, request.runId, (fresh) => ({
            status: "running",
            error: null,
            parkReason: null,
            endedAt: null,
            deadLetteredAt: null,
            resumedAt: now.toISOString(),
            resumedBy: request.actor,
            resumeReason: request.reason,
            resumeAttempts: request.auto ? fresh.resumeAttempts + 1 : fresh.resumeAttempts,
            ...(request.auto
                ? {
                      resumeNotBefore: new Date(
                          now.getTime() +
                              MS *
                                  resumeGapSeconds({
                                      chat: servesCustomer(fresh.context),
                                      resumes: fresh.resumeAttempts,
                                      baseSeconds: request.backoffSeconds,
                                  }),
                      ).toISOString(),
                  }
                : {}),
        }))
        return {
            kind: "resumed",
            stepKey: failed.stepKey,
            workspaceId: request.workspaceId,
            errorCode: failed.errorCode,
            effectKey: `resume-${failed.version}`,
        }
    }

    /**
     * The parked runs of a workspace a machine may run again, oldest first, at most `limit`. With `ladder` a run that serves a customer
     * conversation is due after the rung of its resumes so far (about a minute, then five, then half an hour), any other after `minAgeSeconds`.
     */
    parked(query: ParkedQuery): Promise<ReadonlyArray<ParkedRef>> {
        return this.store.at(query.workspaceId, undefined, async (scoped) => {
            const now = this.clock.now()
            const runs = await this.records.runsOf(
                scoped,
                "parked",
                null,
                [
                    ["resumeNotBefore", "asc"],
                    ["id", "asc"],
                ],
                CANDIDATES_MAX,
            )
            const due = runs.filter(
                (run) =>
                    run.resumeAttempts < query.max &&
                    (run.resumeNotBefore === null || run.resumeNotBefore.getTime() < now.getTime()) &&
                    (run.endedAt === null || run.endedAt.getTime() < now.getTime() - this.ageOf(run, query) * MS) &&
                    (!query.byBuild || run.parkedBuild !== query.build),
            )
            const found: Array<ParkedRef> = []
            await eachInOrder(due, async (run) => {
                if (found.length >= query.limit) return
                const steps = (await this.records.stepsOf(scoped, run.id)).map(stepViewOf)
                if (steps.some((step) => step.status === "failed" && !query.exclude.includes(step.errorCode ?? "")))
                    found.push({ runId: run.id, workspaceId: query.workspaceId })
            })
            return found
        })
    }

    /** Whether a newer run of the agent already finished in the run's customer conversation; only a chat run can be superseded. */
    private async superseded(scoped: ScopedTx, run: RunRecord): Promise<boolean> {
        if (!servesCustomer(run.context)) return false
        const newer = await this.records.runsOf(
            scoped,
            "done",
            { op: "eq", field: "agentId", value: run.agentId },
            [
                ["endedAt", "desc"],
                ["id", "desc"],
            ],
            SUPERSEDE_LOOKBACK,
        )
        return supersededBy(run, newer)
    }

    /** Takes a superseded run off the machine's list: it is closed as dead with why, its owner item stands, a person may still resume it. */
    private async closeSuperseded(scoped: ScopedTx, run: RunRecord): Promise<ResumeAnswer> {
        await this.store.patchRunWith(scoped, run.id, (fresh) =>
            fresh.status === "parked"
                ? { status: "dead", error: { code: SUPERSEDED }, endedAt: this.clock.now().toISOString() }
                : null,
        )
        return { kind: "superseded" }
    }

    /** How long a parked run must have waited before this pass resumes it, seconds. */
    private ageOf(run: RunRecord, query: ParkedQuery): number {
        if (query.ladder !== true) return query.minAgeSeconds
        return parkAgeSeconds({
            chat: servesCustomer(run.context),
            resumes: run.resumeAttempts,
            baseSeconds: query.minAgeSeconds,
        })
    }

    /** The runs of a workspace that stopped on a failed step (parked, failed or dead) for a person to look at, newest first, at most `limit`; a run with no failed step is left out. */
    parkedFacts(workspaceId: string, limit: number): Promise<ReadonlyArray<ParkedFacts>> {
        return this.store.at(workspaceId, undefined, async (scoped) => {
            const runs = (
                await Promise.all(
                    RESUMABLE_RUN.map((status) =>
                        this.records.runsOf(
                            scoped,
                            status,
                            null,
                            [
                                ["resumeNotBefore", "asc"],
                                ["id", "asc"],
                            ],
                            Math.min(limit, CANDIDATES_MAX),
                        ),
                    ),
                )
            ).flat()
            const newestFirst = runs.toSorted(
                (a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0) || b.id.localeCompare(a.id),
            )
            const found: Array<ParkedFacts> = []
            await eachInOrder(newestFirst, async (run) => {
                const steps = await this.records.stepsOf(scoped, run.id)
                const failed = steps.find((step) => step.status === "failed")
                if (failed === undefined) return
                const subject = subjectOfRun(steps[0]?.input, run.context)
                found.push({
                    runId: run.id,
                    agentId: run.agentId,
                    subjectKind: subject?.kind ?? "",
                    subjectId: subject?.id ?? "",
                    stepKey: failed.stepKey,
                    errorCode: failed.errorCode ?? "",
                    parkedAt: (run.endedAt ?? new Date(0)).toISOString(),
                })
            })
            return found.slice(0, limit)
        })
    }

    /** Where one run of the workspace stands; null when the workspace has no such run. */
    async standingOf(workspaceId: string, runId: string): Promise<OptionalRunStanding> {
        const run = await this.store.runById(workspaceId, runId)
        return run?.workspaceId === workspaceId
            ? { agentId: run.agentId, parked: RESUMABLE_RUN.includes(run.status) }
            : null
    }
}
