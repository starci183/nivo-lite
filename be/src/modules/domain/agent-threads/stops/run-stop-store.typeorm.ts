import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { RunStopEntity } from "../persistence/entities"
import { RunStopsError, RunStopsErrorCode } from "./errors/run-stops.error"
import type { RunStop, StopKind, StopState, StopValues } from "./run-stop.contracts"
import { RUN_STOP_ANSWERS_SHAPE, RUN_STOP_ANSWER_SHAPE, RUN_STOP_DETAIL_SHAPE, RUN_STOP_LINES_SHAPE } from "./run-stop.shapes"
import type { RunStopInsert, RunStopStore } from "./run-stop-store.port"

const KINDS: ReadonlyArray<StopKind> = ["ai_report", "ai_error", "approval", "engine"]

/** The stop a row holds; refused when its JSON columns are not the shapes a stop keeps (a row nobody may act on). */
export const runStopOfRow = (row: RunStopEntity): RunStop => {
    const detail = RUN_STOP_DETAIL_SHAPE.safeParse(row.detail)
    const lines = RUN_STOP_LINES_SHAPE.safeParse(row.customerLines)
    const answers = RUN_STOP_ANSWERS_SHAPE.safeParse(row.answers)
    const decision = row.decision === null ? null : RUN_STOP_ANSWER_SHAPE.safeParse(row.decision)
    const kind = KINDS.find((one) => one === row.kind)
    if (!detail.success || !lines.success || !answers.success || kind === undefined || (decision !== null && !decision.success))
        throw new RunStopsError({ code: RunStopsErrorCode.RecordUnreadable })
    return {
        id: row.id,
        version: String(row.version),
        runId: row.runId,
        stepKey: row.stepKey,
        agentId: row.agentId,
        workflowId: row.workflowId,
        contactId: row.contactId,
        conversationId: row.conversationId,
        kind,
        state: row.state === "resolved" ? "resolved" : "open",
        reason: row.reason,
        question: row.question,
        detail: detail.data,
        cardMessageId: row.cardMessageId,
        customerLines: lines.data.lines,
        answers: answers.data.answers,
        decision: decision?.success ? decision.data : null,
        repeats: row.repeats,
        stoppedAt: row.stoppedAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }
}

/** The columns of the members a write sets: the lists wrapped in their objects, the times as instants. */
const columnsOf = (values: StopValues): QueryDeepPartialEntity<RunStopEntity> => ({
    ...(values.kind === undefined ? {} : { kind: values.kind }),
    ...(values.state === undefined ? {} : { state: values.state }),
    ...(values.reason === undefined ? {} : { reason: values.reason }),
    ...(values.contactId === undefined ? {} : { contactId: values.contactId }),
    ...(values.conversationId === undefined ? {} : { conversationId: values.conversationId }),
    ...(values.question === undefined ? {} : { question: values.question }),
    ...(values.detail === undefined ? {} : { detail: structuredClone(values.detail) }),
    ...(values.cardMessageId === undefined ? {} : { cardMessageId: values.cardMessageId }),
    ...(values.customerLines === undefined ? {} : { customerLines: { lines: structuredClone(values.customerLines) } }),
    ...(values.answers === undefined ? {} : { answers: { answers: structuredClone(values.answers) } }),
    ...(values.decision === undefined ? {} : { decision: values.decision === null ? null : structuredClone(values.decision) }),
    ...(values.repeats === undefined ? {} : { repeats: values.repeats }),
    ...(values.stoppedAt === undefined ? {} : { stoppedAt: new Date(values.stoppedAt) }),
    ...(values.resolvedAt === undefined ? {} : { resolvedAt: values.resolvedAt === null ? null : new Date(values.resolvedAt) }),
})

@Injectable()
/**
 * The run stops on public.run_stops, on the primary connection; every write is one statement. No raw SQL. `manager` joins the caller's
 * transaction (a stop opening with the writes that go with it).
 */
export class TypeormRunStopStore implements RunStopStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The stop of one run and step, or null when that step never stopped. */
    async byRunStep(workspaceId: string, runId: string, stepKey: string, manager?: EntityManager): Promise<RunStop | null> {
        const row = await (manager ?? this.entityManager).findOne(RunStopEntity, { where: { workspaceId, runId, stepKey } })
        return row === null ? null : runStopOfRow(row)
    }

    /** The stop with this id in the workspace, or null. */
    async byId(workspaceId: string, id: string, manager?: EntityManager): Promise<RunStop | null> {
        const row = await (manager ?? this.entityManager).findOne(RunStopEntity, { where: { workspaceId, id } })
        return row === null ? null : runStopOfRow(row)
    }

    /** The stops of one run, oldest first, up to the limit. */
    async ofRun(workspaceId: string, runId: string, limit: number): Promise<ReadonlyArray<RunStop>> {
        const rows = await this.entityManager.find(RunStopEntity, {
            where: { workspaceId, runId },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => runStopOfRow(row))
    }

    /** The stops in this state, newest first, up to the limit. */
    async newest(workspaceId: string, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        const rows = await this.entityManager.find(RunStopEntity, {
            where: { workspaceId, state },
            order: { stoppedAt: "DESC", id: "DESC" },
            take: limit,
        })
        return rows.map((row) => runStopOfRow(row))
    }

    /** The stops in this state that concern any of these contacts, oldest first, up to the limit; none when no contact is given. */
    async ofContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        state: StopState,
        limit: number,
    ): Promise<ReadonlyArray<RunStop>> {
        if (contactIds.length === 0) return []
        const rows = await this.entityManager.find(RunStopEntity, {
            where: { workspaceId, contactId: In([...contactIds]), state },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => runStopOfRow(row))
    }

    /** The stops in this state about any of these routes, oldest first, up to the limit; none when no route is given. */
    async ofRoutes(workspaceId: string, routeIds: ReadonlyArray<string>, state: StopState, limit: number): Promise<ReadonlyArray<RunStop>> {
        if (routeIds.length === 0) return []
        const rows = await this.entityManager.find(RunStopEntity, {
            where: { workspaceId, conversationId: In([...routeIds]), state },
            order: { createdAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => runStopOfRow(row))
    }

    /** How many stops hold this state in the workspace. */
    countIn(workspaceId: string, state: StopState): Promise<number> {
        return this.entityManager.count(RunStopEntity, { where: { workspaceId, state } })
    }

    /** Writes the stop for its run and step; null when that run and step held a stop already. */
    async insert(workspaceId: string, stop: RunStopInsert, manager?: EntityManager): Promise<RunStop | null> {
        const inserted = await (manager ?? this.entityManager)
            .createQueryBuilder()
            .insert()
            .into(RunStopEntity)
            .values({
                workspaceId,
                runId: stop.runId,
                stepKey: stop.stepKey,
                agentId: stop.agentId,
                workflowId: stop.workflowId,
                ...columnsOf(stop),
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when the run and step held a stop already.
        const returned: unknown = inserted.raw
        if (!Array.isArray(returned) || returned.length === 0) return null
        return this.byRunStep(workspaceId, stop.runId, stop.stepKey, manager)
    }

    /** Sets the given members on the stop while its version is the expected one; null when the version moved or the stop is gone. */
    async update(workspaceId: string, id: string, expected: string, values: StopValues, manager?: EntityManager): Promise<RunStop | null> {
        const result = await (manager ?? this.entityManager).update(
            RunStopEntity,
            { workspaceId, id, version: Number(expected) },
            { ...columnsOf(values), version: () => "version + 1" },
        )
        return (result.affected ?? 0) > 0 ? this.byId(workspaceId, id, manager) : null
    }
}
