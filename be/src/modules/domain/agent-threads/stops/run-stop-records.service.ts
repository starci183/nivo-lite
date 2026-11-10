import { Injectable } from "@nestjs/common"
import {
    RUN_STOP_ANSWERS_SHAPE,
    RUN_STOP_DECISION_SHAPE,
    RUN_STOP_DETAIL_SHAPE,
    RUN_STOP_LINES_SHAPE,
} from "@nivo-lite/blocks-core/entities"
import type { RunStopAnswer, RunStopCustomerLine, RunStopDecision, RunStopDetail } from "@nivo-lite/blocks-core/entities"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { RunStopsError, RunStopsErrorCode } from "./errors/run-stops.error"
import type { OptionalRunStop, RunStop, StopKind, StopOpen, StopState } from "./run-stop.contracts"

const STOP = "agent.run-stop"

/** Binds the cursor of every list of this store: none is paged past one bounded page. */
const LIST_SCOPE = "run-stops"

/** How often a write is tried again after another writer moved the stop first. */
const WRITE_TRIES = 5

/** The most stops of one run read at once. */
const RUN_PAGE = 50

const SELECT: ReadonlyArray<string> = [
    "runId",
    "stepKey",
    "agentId",
    "workflowId",
    "leadId",
    "conversationId",
    "kind",
    "state",
    "reason",
    "question",
    "detail",
    "cardMessageId",
    "customerLines",
    "answers",
    "decision",
    "repeats",
    "stoppedAt",
    "resolvedAt",
]

const BY_ID: OrderBy = [["id", "asc"]]

/** The newest stops first, by the index `state_stopped` (state, moment). */
const NEWEST: OrderBy = [
    ["stoppedAt", "desc"],
    ["id", "desc"],
]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const textOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const KINDS: ReadonlyArray<StopKind> = ["ai_report", "ai_error", "approval", "engine"]

const unreadable = (): RunStopsError => new RunStopsError({ code: RunStopsErrorCode.RecordUnreadable })

/** The stop a record holds; refused when its fields are not the shape the entity declares. */
export const runStopOf = (row: RecordRow): RunStop => {
    const { data } = row
    const detail = RUN_STOP_DETAIL_SHAPE.safeParse(data.detail)
    const lines = RUN_STOP_LINES_SHAPE.safeParse(data.customerLines)
    const answers = RUN_STOP_ANSWERS_SHAPE.safeParse(data.answers)
    const decision = data.decision === null || data.decision === undefined ? null : RUN_STOP_DECISION_SHAPE.safeParse(data.decision)
    const kind = KINDS.find((one) => one === data.kind)
    const runId = textOrNull(data.runId)
    const stepKey = textOrNull(data.stepKey)
    const agentId = textOrNull(data.agentId)
    const reason = typeof data.reason === "string" ? data.reason : null
    if (
        !detail.success ||
        !lines.success ||
        !answers.success ||
        (decision !== null && !decision.success) ||
        kind === undefined ||
        runId === null ||
        stepKey === null ||
        agentId === null ||
        reason === null
    ) {
        throw unreadable()
    }
    return {
        id: row.id,
        version: row.version,
        runId,
        stepKey,
        agentId,
        workflowId: textOrNull(data.workflowId),
        leadId: textOrNull(data.leadId),
        conversationId: textOrNull(data.conversationId),
        kind,
        state: data.state === "resolved" ? "resolved" : "open",
        reason,
        question: textOrNull(data.question),
        detail: detail.data,
        cardMessageId: textOrNull(data.cardMessageId),
        customerLines: lines.data.lines,
        answers: answers.data.answers,
        decision: decision === null ? null : decision.success ? decision.data : null,
        repeats: typeof data.repeats === "number" ? data.repeats : 1,
        stoppedAt: typeof data.stoppedAt === "string" ? data.stoppedAt : row.createdAt,
        resolvedAt: textOrNull(data.resolvedAt),
    }
}

/** The values a write of a stop may set; a member left out is kept. */
export interface StopValues {
    readonly kind?: StopKind
    readonly state?: StopState
    readonly reason?: string
    readonly question?: string | null
    readonly detail?: RunStopDetail
    readonly cardMessageId?: string | null
    readonly customerLines?: ReadonlyArray<RunStopCustomerLine>
    readonly answers?: ReadonlyArray<RunStopAnswer>
    readonly decision?: RunStopDecision | null
    readonly repeats?: number
    readonly stoppedAt?: string
    readonly resolvedAt?: string | null
}

/** What a write of a stop answers to build its values from the stop as it stands; null writes nothing. */
export type StopBuild = (stop: RunStop) => StopValues | null

/** A plain JSON copy of a value the entity shapes already judged. */
const jsonOf = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue

/** The values of a write as the engine takes them: the lists wrapped in their objects, the rest as they are. */
const valuesOf = (values: StopValues): MutationValues => {
    const plain: Record<string, JsonValue> = {}
    const { detail, customerLines, answers, decision, ...rest } = values
    for (const [name, value] of Object.entries(rest)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null)
            plain[name] = value
    }
    if (detail !== undefined) plain.detail = jsonOf(detail)
    if (customerLines !== undefined) plain.customerLines = jsonOf({ lines: customerLines })
    if (answers !== undefined) plain.answers = jsonOf({ answers })
    if (decision !== undefined) plain.decision = decision === null ? null : jsonOf(decision)
    return plain
}

@Injectable()
/**
 * The one place that names the `agent.run-stop` entity. Reads are indexed queries of the entity engine (by run and step: the unique key;
 * by run). A write is an engine update under the version read, read again and rebuilt when another writer moved the stop first.
 */
export class RunStopRecordsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
    ) {}

    /** The stop of a step of a run, or null. */
    byRunStep(workspaceId: string, runId: string, stepKey: string): Promise<OptionalRunStop> {
        return this.engine.scoped(workspaceId, (tx) =>
            this.first(tx, { op: "and", of: [eq("runId", runId), eq("stepKey", stepKey)] }),
        )
    }

    /** One stop by its id, or null. */
    byId(workspaceId: string, id: string): Promise<OptionalRunStop> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const row = await this.engine.get(tx, STOP, id)
            return row === null ? null : runStopOf(row)
        })
    }

    /** The stops of a run, in the order they were first written. */
    ofRun(workspaceId: string, runId: string): Promise<ReadonlyArray<RunStop>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const page = await this.engine.list(
                tx,
                { from: STOP, select: SELECT, where: eq("runId", runId), order: BY_ID, page: { size: RUN_PAGE } },
                LIST_SCOPE,
            )
            return page.rows.map((listed) => runStopOf(listed.row))
        })
    }

    /** The newest stops of one state of the workspace, at most `limit` (one page), by the entity's index on state and moment. */
    newest(workspaceId: string, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const page = await this.engine.list(
                tx,
                {
                    from: STOP,
                    select: SELECT,
                    where: eq("state", state),
                    order: NEWEST,
                    page: { size: Math.min(Math.max(limit, 1), RUN_PAGE) },
                },
                LIST_SCOPE,
            )
            return page.rows.map((listed) => runStopOf(listed.row))
        })
    }

    /**
     * The stop of the step, open: a new record the first time, else the same record opened again (one more repeat, the new words, no
     * decision) with its card, customer lines and answers kept. The unique key makes a race find the one written first.
     */
    open(input: StopOpen, now: string): Promise<RunStop> {
        const words = {
            kind: input.kind,
            reason: input.reason,
            question: input.question,
            detail: { suggestions: input.suggestions, facts: input.facts },
        }
        return this.engine.scoped(input.workspaceId, async (tx) => {
            const values = valuesOf({
                ...words,
                state: "open",
                customerLines: [],
                answers: [],
                decision: null,
                repeats: 1,
                stoppedAt: now,
                resolvedAt: null,
            })
            const made = await this.mutations.mutate(
                tx,
                {
                    op: "ensure",
                    entity: STOP,
                    match: "run_step",
                    values: {
                        ...values,
                        runId: input.runId,
                        stepKey: input.stepKey,
                        agentId: input.agentId,
                        workflowId: input.workflowId,
                        leadId: input.leadId,
                        conversationId: input.conversationId,
                    },
                },
                "job",
            )
            const found = made.ok
                ? runStopOf(made.row)
                : await this.first(tx, { op: "and", of: [eq("runId", input.runId), eq("stepKey", input.stepKey)] })
            if (found === null) throw unreadable()
            if (made.ok && made.created) return found
            const reopened = await this.patchIn(
                tx,
                found.id,
                (stop) => ({
                    ...words,
                    state: "open",
                    decision: null,
                    repeats: stop.state === "resolved" || stop.decision !== null ? stop.repeats + 1 : stop.repeats,
                    stoppedAt: now,
                    resolvedAt: null,
                }),
                WRITE_TRIES,
            )
            return reopened ?? found
        })
    }

    /**
     * Writes what `build` answers for the stop as it stands, under the version read; when another writer moved it first, it is read and
     * built again. Answers the stop after the write, or null when `build` answered no write.
     */
    patch(workspaceId: string, id: string, build: StopBuild): Promise<OptionalRunStop> {
        return this.engine.scoped(workspaceId, (tx) => this.patchIn(tx, id, build, WRITE_TRIES))
    }

    private async patchIn(tx: ScopedTx, id: string, build: StopBuild, left: number): Promise<OptionalRunStop> {
        if (left <= 0) throw new RunStopsError({ code: RunStopsErrorCode.Contended })
        const row = await this.engine.get(tx, STOP, id)
        if (row === null) throw new RunStopsError({ code: RunStopsErrorCode.NotFound })
        const stop = runStopOf(row)
        const values = build(stop)
        if (values === null) return null
        const result = await this.mutations.mutate(
            tx,
            { op: "update", entity: STOP, key: id, expected: stop.version, values: valuesOf(values) },
            "job",
        )
        if (result.ok) return runStopOf(result.row)
        if (result.reason === "stale") return this.patchIn(tx, id, build, left - 1)
        throw unreadable()
    }

    private async first(tx: ScopedTx, where: FilterExpr): Promise<OptionalRunStop> {
        const page = await this.engine.list(
            tx,
            { from: STOP, select: SELECT, where, order: BY_ID, page: { size: 1 } },
            LIST_SCOPE,
        )
        const row = page.rows.at(0)?.row
        return row === undefined ? null : runStopOf(row)
    }
}
