import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionRecord } from "./decisions-views.contracts"
import { DecisionEntity } from "./persistence/entities"

/** Orders two texts that compare byte by byte (fixed-width instants, lower-case uuids), the greater first. */
const newestFirst = (left: string, right: string): number => {
    if (left === right) return 0
    return left < right ? 1 : -1
}

/** What the history is narrowed to; a null filter does not narrow. */
export interface DecisionHistoryFilter {
    /** The deciders to keep (`policy`, `owner`, `staff`). */
    readonly deciders: ReadonlyArray<string> | null
    /** The outcome to keep. */
    readonly outcome: string | null
    /** The module to keep. */
    readonly department: string | null
    /** The most lines. */
    readonly limit: number
}

/** A line of the history before the customer name is read; `sort_key` orders lines of different sources at full precision. */
type RawLine = Omit<DecisionRecord, "leadName"> & { readonly sort_key: string }

/** Postgres text of the instant that sorts like the instant: fixed width, UTC, to the microsecond. */
const SORT_KEY = "YYYYMMDDHH24MISS.US"

/** The deciders an approval request resolved by this member counts as. */
const REQUEST_DECIDER = "(CASE WHEN m.id IS NULL THEN 'policy' WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END)"

/** The deciders a hand-off a member completed counts as. */
const TASK_DECIDER = "(CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'staff' END)"

/** The instant an approval request counts at: when it was resolved, else when it was made. */
const REQUEST_AT = "COALESCE(r.resolved_at, r.created_at)"

/** The instant a completed hand-off counts at. */
const TASK_AT = "COALESCE(c.finished_at, c.started_at)"

/** Where the decider, the outcome and the module of a line live in its source. */
interface HistoryExpressions {
    /** The decider expression. */
    readonly decider: string
    /** The outcome expression. */
    readonly outcome: string
    /** The module expression. */
    readonly department: string
}

/** Keeps the lines whose decider, outcome and module match the filter; `expressions` say where each lives in the source. */
const narrow = (
    select: SelectQueryBuilder<ObjectLiteral>,
    filter: DecisionHistoryFilter,
    expressions: HistoryExpressions,
): SelectQueryBuilder<ObjectLiteral> => {
    if (filter.deciders !== null)
        select.andWhere(`${expressions.decider} IN (:...deciders)`, { deciders: [...filter.deciders] })
    if (filter.outcome !== null) select.andWhere(`${expressions.outcome} = :outcome`, { outcome: filter.outcome })
    if (filter.department !== null) {
        select.andWhere(`${expressions.department} = :department`, { department: filter.department })
    }
    return select
}

/** The decision log lines: who decided each work item. */
const loggedDecisions = (
    manager: EntityManager,
    workspaceId: string,
    filter: DecisionHistoryFilter,
): Promise<Array<RawLine>> =>
    narrow(
        manager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id", "id")
            .addSelect("d.workItemId", "work_item_id")
            .addSelect("d.leadId", "lead_id")
            .addSelect("d.department", "department")
            .addSelect("d.action", "action")
            .addSelect("COALESCE(m.display_name, d.decidedBy)", "decided_by")
            .addSelect("d.decidedByMemberId", "decidedByMemberId")
            .addSelect("d.deciderKind", "decider_kind")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.reason", "reason")
            .addSelect("COALESCE(d.note, '')", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .addSelect(`to_char(d.createdAt AT TIME ZONE 'UTC', '${SORT_KEY}')`, "sort_key")
            .leftJoin("workspace_members", "m", "m.id = d.decidedByMemberId")
            .where("d.workspaceId = :workspaceId", { workspaceId }),
        filter,
        { decider: "d.deciderKind", outcome: "d.outcome", department: "d.department" },
    )
        .orderBy("d.createdAt", "DESC")
        .addOrderBy("d.id", "DESC")
        .limit(filter.limit)
        .getRawMany<RawLine>()

/** The approval requests the engine does not log: verdicts given on a thread card outside an agent's work, and every one that ran out of time. */
const approvalRequests = async (
    manager: EntityManager,
    workspaceId: string,
    filter: DecisionHistoryFilter,
): Promise<Array<RawLine>> => {
    const lines = await narrow(
        manager
            .createQueryBuilder()
            .select("r.id", "id")
            .addSelect("t.lead_id", "lead_id")
            .addSelect("r.department", "department")
            .addSelect("r.action", "action")
            .addSelect("COALESCE(m.display_name, 'NIVO')", "decided_by")
            .addSelect("r.resolved_by", "decidedByMemberId")
            .addSelect(REQUEST_DECIDER, "decider_kind")
            .addSelect("r.status", "outcome")
            .addSelect("COALESCE(ar.note, '')", "note")
            .addSelect(`to_json(${REQUEST_AT}) #>> '{}'`, "created_at")
            .addSelect(`to_char(${REQUEST_AT} AT TIME ZONE 'UTC', '${SORT_KEY}')`, "sort_key")
            .from("public.approval_requests", "r")
            .leftJoin("workspace_members", "m", "m.id = r.resolved_by")
            .leftJoin("work_chains", "c", "c.id = r.chain_step_id")
            .leftJoin("work_threads", "t", "t.id = c.thread_id")
            .leftJoin("authority_rules", "ar", "ar.workspace_id = r.workspace_id AND ar.action = r.action")
            .where("r.workspace_id = :workspaceId AND r.status <> 'pending'", { workspaceId })
            .andWhere(
                "(r.status = 'expired' OR NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.approval_request_id = r.id))",
            ),
        filter,
        { decider: REQUEST_DECIDER, outcome: "r.status", department: "r.department" },
    )
        .orderBy(REQUEST_AT, "DESC")
        .addOrderBy("r.id", "DESC")
        .limit(filter.limit)
        .getRawMany<Omit<RawLine, "work_item_id" | "reason">>()
    return lines.map((line) => ({ ...line, work_item_id: null, reason: "over_authority" }))
}

/** The tasks a member completed after being tagged in a thread no agent's work runs in. */
const threadTasks = async (
    manager: EntityManager,
    workspaceId: string,
    filter: DecisionHistoryFilter,
): Promise<Array<RawLine>> => {
    if (filter.outcome !== null && filter.outcome !== "completed") return []
    const lines = await narrow(
        manager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("t.lead_id", "lead_id")
            .addSelect("COALESCE(a.module, 'office')", "department")
            .addSelect("m.display_name", "decided_by")
            .addSelect("c.decided_by", "decidedByMemberId")
            .addSelect(TASK_DECIDER, "decider_kind")
            .addSelect("COALESCE(c.rule, c.action)", "note")
            .addSelect(`to_json(${TASK_AT}) #>> '{}'`, "created_at")
            .addSelect(`to_char(${TASK_AT} AT TIME ZONE 'UTC', '${SORT_KEY}')`, "sort_key")
            .from("public.work_chains", "c")
            .innerJoin("workspace_members", "m", "m.id = c.decided_by")
            .innerJoin("work_threads", "t", "t.id = c.thread_id")
            .leftJoin("agents", "a", "a.id = c.actor_id AND c.actor_kind = 'agent'")
            .where("c.workspace_id = :workspaceId AND c.kind IN ('hand_off', 'assign') AND c.status = 'done'", {
                workspaceId,
            })
            .andWhere("NOT EXISTS (SELECT 1 FROM public.thread_work w WHERE w.thread_id = c.thread_id)"),
        { ...filter, outcome: null },
        { decider: TASK_DECIDER, outcome: "'completed'", department: "COALESCE(a.module, 'office')" },
    )
        .orderBy(TASK_AT, "DESC")
        .addOrderBy("c.id", "DESC")
        .limit(filter.limit)
        .getRawMany<Omit<RawLine, "work_item_id" | "reason" | "action" | "outcome">>()
    return lines.map((line) => ({
        ...line,
        work_item_id: null,
        action: "thread_task",
        outcome: "completed",
        reason: null,
    }))
}

@Injectable()
/** Reads the decision history of a workspace from the three sources that hold it. */
export class DecisionHistoryService {
    /** Captures the primary entity manager. */
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * The newest lines of the decision history with the customer name: the decision log of the work engine, the approval requests the
     * engine does not log (verdicts given on a thread card outside an agent's work, and every request that ran out of time), and the
     * tasks a member completed after being tagged in a thread no agent's work runs in. Each source is read for its newest `limit`
     * lines, the lines are merged newest first (ties by id, descending), and the customer names are read for the page.
     */
    async list(workspaceId: string, filter: DecisionHistoryFilter): Promise<Array<DecisionRecord>> {
        const sources = [
            ...(await loggedDecisions(this.entityManager, workspaceId, filter)),
            ...(await approvalRequests(this.entityManager, workspaceId, filter)),
            ...(await threadTasks(this.entityManager, workspaceId, filter)),
        ]
        const page = sources
            .toSorted((left, right) => newestFirst(left.sort_key, right.sort_key) || newestFirst(left.id, right.id))
            .slice(0, filter.limit)
        const leadIds = [...new Set(page.flatMap((line) => (line.lead_id === null ? [] : [line.lead_id])))]
        const leads =
            leadIds.length === 0
                ? []
                : await this.entityManager
                      .createQueryBuilder()
                      .select("l.id", "id")
                      .addSelect("l.contact_name", "name")
                      .from("public.leads", "l")
                      .where("l.id IN (:...leadIds)", { leadIds })
                      .getRawMany<{ id: string; name: string | null }>()
        const names = new Map(leads.map((lead) => [lead.id, lead.name]))
        return page.map(({ sort_key: _key, ...line }) => ({
            ...line,
            leadName: line.lead_id === null ? null : (names.get(line.lead_id) ?? null),
        }))
    }
}
