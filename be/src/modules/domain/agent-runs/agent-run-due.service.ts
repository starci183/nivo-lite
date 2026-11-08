import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { StepRecord } from "./agent-runs-records.contracts"
import { TELL_STATUSES } from "./policies/agent-runs.policy"
import type { RunDue } from "./agent-runs-engine.contracts"

/** How long a stopped run or an undo waits before the sweep looks at it, milliseconds. */
const SWEEP_GRACE_MS = 60_000

const iso = (at: Date): string => at.toISOString()

@Injectable()
/**
 * What the minute sweep must look at in one workspace, as indexed reads: steps past their claim (a crash, or a wait whose time ran out),
 * pending steps that are ready and that no job picked up, compensations to continue, and stopped runs nobody was told about. The run of
 * each step is read to keep only those whose run still wants it.
 */
export class AgentRunDueService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly store: AgentRunStoreService,
        private readonly records: AgentRunRecordsService,
    ) {}

    /** What the sweep must look at in the workspace, at most `limit` of each kind. */
    due(workspaceId: string, limit: number): Promise<ReadonlyArray<RunDue>> {
        return this.store.at(workspaceId, undefined, async (scoped) => {
            const now = this.clock.now()
            const stale = iso(new Date(now.getTime() - SWEEP_GRACE_MS))
            const found = [
                ...(await this.expired(scoped, workspaceId, now, limit)),
                ...(await this.ready(scoped, workspaceId, stale, limit)),
                ...(await this.compensating(scoped, workspaceId, now, stale, limit)),
                ...(await this.unspoken(scoped, workspaceId, stale, limit)),
            ]
            return found
        })
    }

    private async expired(scoped: ScopedTx, workspaceId: string, now: Date, limit: number): Promise<Array<RunDue>> {
        const steps = await this.records.stepsOfStatus(
            scoped,
            "running",
            { op: "lt", field: "claimedUntil", value: iso(now) },
            [
                ["claimedUntil", "asc"],
                ["id", "asc"],
            ],
            limit,
        )
        return this.dueOf(scoped, workspaceId, "expired", steps, ["running", "waiting"], (step) => step.claimedUntil)
    }

    private async ready(scoped: ScopedTx, workspaceId: string, stale: string, limit: number): Promise<Array<RunDue>> {
        const steps = await this.records.stepsOfStatus(
            scoped,
            "pending",
            { op: "lt", field: "notBefore", value: stale },
            [
                ["notBefore", "asc"],
                ["id", "asc"],
            ],
            limit,
        )
        const due = await this.dueOf(scoped, workspaceId, "ready", steps, ["running"], (step) => step.notBefore)
        const free: Array<RunDue> = []
        await eachInOrder(due, async (item) => {
            const all = await this.records.stepsOf(scoped, item.runId)
            const earlier = all
                .slice(
                    0,
                    all.findIndex((step) => step.stepKey === item.stepKey),
                )
                .filter(
                    (other) =>
                        other.status === "pending" ||
                        other.status === "failed" ||
                        (other.status === "running" && other.waitItemId === null),
                )
            if (earlier.length === 0) free.push(item)
        })
        return free
    }

    private async compensating(
        scoped: ScopedTx,
        workspaceId: string,
        now: Date,
        stale: string,
        limit: number,
    ): Promise<Array<RunDue>> {
        const idle: FilterExprList = [
            { op: "isNull", field: "claimedUntil" },
            { op: "lt", field: "claimedUntil", value: iso(now) },
        ]
        const lists = await Promise.all(
            idle.map((claim) =>
                this.records.stepsOfStatus(
                    scoped,
                    "compensating",
                    { op: "and", of: [claim, { op: "lt", field: "updatedAt", value: stale }] },
                    [
                        ["claimedUntil", "asc"],
                        ["id", "asc"],
                    ],
                    limit,
                ),
            ),
        )
        return this.dueOf(
            scoped,
            workspaceId,
            "compensating",
            lists.flat().slice(0, limit),
            ["compensating"],
            (step) => step.claimedUntil ?? new Date(0),
        )
    }

    private async unspoken(
        scoped: ScopedTx,
        workspaceId: string,
        stale: string,
        limit: number,
    ): Promise<Array<RunDue>> {
        const lists = await Promise.all(
            TELL_STATUSES.map((status) =>
                this.records.runsOf(
                    scoped,
                    status,
                    {
                        op: "and",
                        of: [
                            { op: "isNull", field: "deadLetteredAt" },
                            { op: "lt", field: "updatedAt", value: stale },
                        ],
                    },
                    [
                        ["deadLetteredAt", "asc"],
                        ["id", "asc"],
                    ],
                    limit,
                ),
            ),
        )
        return lists
            .flat()
            .slice(0, limit)
            .map((run) => ({
                kind: "unspoken",
                runId: run.id,
                workspaceId,
                agentId: run.agentId,
                stepKey: "",
                fence: 0,
                at: this.clock.now(),
            }))
    }

    /** The steps whose run is in one of `statuses`, as due items. */
    private async dueOf(
        scoped: ScopedTx,
        workspaceId: string,
        kind: RunDue["kind"],
        steps: ReadonlyArray<StepRecord>,
        statuses: ReadonlyArray<string>,
        at: (step: StepRecord) => Date | null,
    ): Promise<Array<RunDue>> {
        const due: Array<RunDue> = []
        await eachInOrder(steps, async (step) => {
            const run = await this.records.run(scoped, step.runId)
            if (run === null || !statuses.includes(run.status)) return
            due.push({
                kind,
                runId: run.id,
                workspaceId,
                agentId: run.agentId,
                stepKey: step.stepKey,
                fence: Number(step.version),
                at: at(step) ?? this.clock.now(),
            })
        })
        return due
    }
}

type FilterExprList = ReadonlyArray<
    | { readonly op: "isNull"; readonly field: string }
    | { readonly op: "lt"; readonly field: string; readonly value: string }
>
