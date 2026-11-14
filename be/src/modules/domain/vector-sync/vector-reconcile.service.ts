import { Injectable, Optional } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import {
    InjectVectorIndex,
    InjectVectorIndexBoot,
    PLATFORM_TENANT,
    VECTOR_KINDS,
    type VectorIndex,
    type VectorIndexBoot,
    type VectorKind,
    type VectorRow,
} from "@modules/integrations/qdrant"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { VectorSyncQueue } from "@modules/queues/vector-sync"
import { VectorSyncStateEntity } from "./persistence/entities"
import type {
    VectorDriftReporter,
    VectorReconcileDone,
    VectorReconcileKindDone,
    VectorSyncDone,
} from "./vector-sync.contracts"
import { InjectVectorDriftReporter, InjectVectorRowSources, type VectorRowSources } from "./vector-sync.decorators"
import { VectorSyncLogEvent } from "./vector-sync.log-events"
import {
    DRIFT_RUNS_TO_REPORT,
    RECONCILE_EMBED_CALLS,
    RECONCILE_PAGE,
    RECONCILE_POINTS_PER_RUN,
    RECONCILE_ROWS_PER_RUN,
    REPORT_WORKSPACES_MAX,
    addDone,
    noneDone,
    orphansOf,
    repairedSomething,
} from "./vector-sync.policy"
import { VectorSyncService } from "./vector-sync.service"

/** Where the walks of one kind stand between two runs. */
interface Cursors {
    /** The last row id compared; null = from the first row. */
    readonly rowsAfter: string | null
    /** The index's page cursor of the walk over its points; null = from the first point. */
    readonly pointsAfter: string | null
}

/** What one run did for one kind, with where its walks stopped and what it could not repair. */
interface KindRun {
    /** The counts. */
    readonly done: VectorReconcileKindDone
    /** Where the next run goes on. */
    readonly cursors: Cursors
    /** True when the index or an embedding call failed: the run stopped for this kind and its cursor stays on the failing page. */
    readonly stopped: boolean
    /** The workspaces of the rows the run could not bring in step. */
    readonly troubled: ReadonlyArray<string>
}

/** The state one kind's two walks share while a run goes on. */
interface WalkState {
    /** The counts so far. */
    done: VectorSyncDone
    /** Rows compared so far. */
    rows: number
    /** Points compared so far. */
    points: number
    /** The row cursor. */
    rowsAfter: string | null
    /** The point cursor. */
    pointsAfter: string | null
    /** True when the rows walk reached the end. */
    rowsWrapped: boolean
    /** True when the points walk reached the end. */
    pointsWrapped: boolean
    /** True when the index or an embedding call failed. */
    stopped: boolean
    /** The workspaces of the rows the run could not bring in step. */
    troubled: Array<string>
    /** The page of rows being settled, kept for the workspaces a failure names. */
    page: ReadonlyArray<VectorRow>
}

/** The distinct workspaces of some rows, at most the report's bound; the platform tenant has no founder to tell (its drift is logged). */
const workspacesOf = (rows: ReadonlyArray<VectorRow>): ReadonlyArray<string> =>
    [...new Set(rows.map((row) => row.workspaceId))].filter((tenant) => tenant !== PLATFORM_TENANT).slice(0, REPORT_WORKSPACES_MAX)

@Injectable()
/**
 * The reconcile of the vector index against Postgres: the safety net under the `vector.sync` jobs, and the REBUILD (an empty index
 * is only the largest drift). One run, per kind of point, walks two ways, each bounded and resumable from a stored cursor:
 * - rows → points: a page of Postgres rows in id order (the primary key), the points of those ids read from the index in one call,
 *   the difference settled exactly as a sync job would (`VectorSyncService.settle`): a row with no point, a point of another text,
 *   model or workspace, stale flags, a point of a row that must hold none;
 * - points → rows: a page of the index's points, the rows that still want one asked from Postgres in one statement, the points
 *   whose row is gone removed (a deleted document, a deleted workspace).
 * A run that repaired something and used its whole budget queues its own follow-up at once (a rebuild runs back to back); a clean
 * run waits for the next tick. A run that could not repair what it met (the index down, an embedding call failing) counts; after
 * `DRIFT_RUNS_TO_REPORT` such runs in a row the founders of the workspaces it could not serve are told ONCE (NIVO's background
 * report, one card per episode). Rows that wait for credits are not drift: they wait, found by words meanwhile.
 */
export class VectorReconcileService {
    constructor(
        @InjectVectorIndex() private readonly index: VectorIndex,
        @InjectVectorIndexBoot() private readonly boot: VectorIndexBoot,
        @InjectVectorRowSources() private readonly sources: VectorRowSources,
        private readonly sync: VectorSyncService,
        private readonly queue: VectorSyncQueue,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        @Optional() @InjectVectorDriftReporter() private readonly notices?: VectorDriftReporter | null,
    ) {}

    /** One run: every kind, inside its budget. Never throws for the index: a failure is counted, logged and tried again by the next run. */
    async run(): Promise<VectorReconcileDone> {
        const index = this.index
        const prepared = await this.boot.prepare()
        const tally = { stopped: false, repaired: false, unfinished: false, driftRuns: 0, reported: 0 }
        const kinds: Partial<Record<VectorKind, VectorReconcileKindDone>> = {}
        const now = this.clock.now()
        const states = await this.entityManager.find(VectorSyncStateEntity, {
            where: { kind: In([...VECTOR_KINDS]) },
            take: VECTOR_KINDS.length,
        })
        await eachInOrder(VECTOR_KINDS, async (kind) => {
            const state = states.find((one) => one.kind === kind)
            const from: Cursors = { rowsAfter: state?.rowsAfter ?? null, pointsAfter: state?.pointsAfter ?? null }
            const ran = prepared ? await this.walk(index, kind, from) : await this.unreached(kind, from)
            const drifting = ran.stopped || ran.done.failed > 0
            const driftRuns = drifting ? (state?.driftRuns ?? 0) + 1 : 0
            const driftSince = drifting ? (state?.driftSince ?? now) : null
            await this.entityManager.upsert(
                VectorSyncStateEntity,
                {
                    kind,
                    rowsAfter: ran.cursors.rowsAfter,
                    pointsAfter: ran.cursors.pointsAfter,
                    passes: (state?.passes ?? 0) + (ran.done.rowsWrapped ? 1 : 0),
                    driftRuns,
                    driftSince,
                    lastRunAt: now,
                },
                ["kind"],
            )
            kinds[kind] = ran.done
            tally.stopped ||= ran.stopped
            tally.repaired ||= repairedSomething(ran.done)
            tally.unfinished ||= !ran.done.rowsWrapped && !ran.stopped
            tally.driftRuns = Math.max(tally.driftRuns, driftRuns)
            if (driftRuns === DRIFT_RUNS_TO_REPORT && driftSince !== null) {
                tally.reported += await this.report(kind, ran.troubled, driftSince)
            }
        })
        const continued = !tally.stopped && tally.repaired && tally.unfinished
        if (continued) {
            await this.entityManager.transaction((tx) => this.queue.enqueueReconcile({ resumedAt: now.getTime() }, tx))
        }
        const done: VectorReconcileDone = {
            outcome: tally.stopped ? "stopped" : "ran",
            kinds,
            continued,
            driftRuns: tally.driftRuns,
            reported: tally.reported,
        }
        this.logger.info(VectorSyncLogEvent.Reconciled, { ...done })
        return done
    }

    /** A run that could not reach the index: nothing walked, the cursors kept, the first rows' workspaces named as unserved. */
    private async unreached(kind: VectorKind, from: Cursors): Promise<KindRun> {
        const first = await this.sources[kind].page(null, RECONCILE_PAGE)
        return {
            done: { ...noneDone(), rows: 0, points: 0, rowsWrapped: false, pointsWrapped: false },
            cursors: from,
            stopped: true,
            troubled: workspacesOf(first.filter((row) => row.wanted)),
        }
    }

    /** The two walks of one kind; a failure of the index stops the kind where it is and keeps the cursor on the page that failed. */
    private async walk(index: VectorIndex, kind: VectorKind, from: Cursors): Promise<KindRun> {
        const run: WalkState = {
            done: noneDone(),
            rows: 0,
            points: 0,
            rowsAfter: from.rowsAfter,
            pointsAfter: from.pointsAfter,
            rowsWrapped: false,
            pointsWrapped: false,
            stopped: false,
            troubled: new Array<string>(),
            page: [],
        }
        try {
            await this.walkRows(index, kind, run, RECONCILE_EMBED_CALLS)
            run.page = []
            await this.walkPoints(index, kind, run)
        } catch (cause) {
            run.stopped = true
            run.troubled.push(...workspacesOf(run.page))
            this.logger.error(VectorSyncLogEvent.ReconcileStopped, cause, { kind, rows: run.rows, points: run.points })
        }
        return {
            done: { ...run.done, rows: run.rows, points: run.points, rowsWrapped: run.rowsWrapped, pointsWrapped: run.pointsWrapped },
            cursors: { rowsAfter: run.rowsAfter, pointsAfter: run.pointsAfter },
            stopped: run.stopped,
            troubled: [...new Set(run.troubled)].slice(0, REPORT_WORKSPACES_MAX),
        }
    }

    /** The rows to points walk: one page of rows per step, until the run's row budget is spent, a page fails, or the rows wrap. */
    private async walkRows(index: VectorIndex, kind: VectorKind, run: WalkState, embedLeft: number): Promise<void> {
        if (run.rows >= RECONCILE_ROWS_PER_RUN) return
        run.page = await this.sources[kind].page(run.rowsAfter, RECONCILE_PAGE)
        const page = run.page
        if (page.length === 0) {
            run.rowsWrapped = true
            run.rowsAfter = null
            return
        }
        const stamps = await index.stampsOf(
            kind,
            page.map((row) => row.id),
        )
        const settled: VectorSyncDone = await this.sync.settle(index, kind, page, stamps, { embedCalls: embedLeft })
        run.done = addDone(run.done, settled)
        const left = embedLeft - settled.embedCalls
        if (settled.failed > 0) {
            run.troubled.push(...workspacesOf(page))
            return
        }
        // Rows left waiting because THIS run's embedding budget is spent: the page is met again by the next run.
        if (left <= 0 && settled.waiting > 0) return
        run.rows += page.length
        run.rowsAfter = page.at(-1)?.id ?? run.rowsAfter
        await this.walkRows(index, kind, run, left)
    }

    /** The points to rows walk: one page of the index's points per step, the points whose row is gone removed, until the budget is spent or the points wrap. */
    private async walkPoints(index: VectorIndex, kind: VectorKind, run: WalkState): Promise<void> {
        if (run.points >= RECONCILE_POINTS_PER_RUN) return
        const held = await index.stamps(kind, {}, { limit: RECONCILE_PAGE, after: run.pointsAfter })
        const wanted = await this.sources[kind].wantedAmong(held.points.map((point) => point.id))
        await eachInOrder(orphansOf(held.points, new Set(wanted.map((row) => row.id))), async ([workspaceId, ids]) => {
            await index.remove(kind, workspaceId, ids)
            run.done = addDone(run.done, { removed: ids.length })
        })
        run.points += held.points.length
        run.pointsAfter = held.next
        if (held.next === null) {
            run.pointsWrapped = true
            return
        }
        await this.walkPoints(index, kind, run)
    }

    /** Tells the founders of the workspaces a drift episode left unserved, once per episode; answers how many were told. Never throws. */
    private async report(kind: VectorKind, workspaces: ReadonlyArray<string>, episode: Date): Promise<number> {
        const notices = this.notices
        if (notices == null) return 0
        let told = 0
        await eachInOrder(workspaces, async (workspaceId) => {
            try {
                const posted = await notices.postBackgroundStopped(workspaceId, {
                    work: "brain.vectors.sync",
                    reason: "gave_up",
                    episode,
                })
                if (posted === "posted") told += 1
                this.logger.info(VectorSyncLogEvent.DriftReported, { kind, workspaceId, posted })
            } catch (cause) {
                this.logger.error(VectorSyncLogEvent.DriftReportFailed, cause, { kind, workspaceId })
            }
        })
        return told
    }
}
