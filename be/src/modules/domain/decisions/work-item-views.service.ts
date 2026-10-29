import { Injectable } from "@nestjs/common"
import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DecisionEntity } from "./persistence/entities"
import type { AccountingWaitingWorkRow, WorkItemViewRow } from "./work-item-views.rows"

/** The columns of public.work_items a work item view carries as they are. */
const PLAIN_COLUMNS = [
    "workspace_id",
    "department",
    "action",
    "subject_type",
    "subject_id",
    "lead_id",
    "inbound_event_id",
    "parent_id",
    "chain_id",
    "depth",
    "status",
    "decided_path",
    "reason",
    "reasons",
    "missing_fields",
    "proposal",
    "result",
    "error",
    "evidence_state",
    "assigned_staff_id",
    "execution_id",
    "installation_id",
] as const

/** The instants of public.work_items, which a view carries as ISO text at full precision. */
const STAMP_COLUMNS = ["created_at", "updated_at", "completed_at"] as const

/** One page of work items asked for: no status filter when `statuses` is empty, no action filter when `action` is null. */
export interface WorkItemViewFilter {
    /** The statuses to keep. */
    readonly statuses: ReadonlyArray<string>
    /** The keyset position after which the page starts. */
    readonly after: { readonly createdAt: string; readonly id: string } | null
    /** The action to keep. */
    readonly action: string | null
    /** How many rows. */
    readonly limit: number
}

/** The select of a work item: its columns, the instants as ISO text at full precision. */
const itemSelect = (manager: EntityManager): SelectQueryBuilder<ObjectLiteral> => {
    const select = manager.createQueryBuilder().from("public.work_items", "w").select("w.id", "id")
    for (const column of PLAIN_COLUMNS) select.addSelect(`w.${column}`, column)
    for (const column of STAMP_COLUMNS) select.addSelect(`to_json(w.${column}) #>> '{}'`, column)
    return select
}

/** The select of a work item view: the item, the keyset cursor and the name of its latest decision. */
const viewSelect = (manager: EntityManager): SelectQueryBuilder<ObjectLiteral> =>
    itemSelect(manager)
        .addSelect("to_json(w.created_at) #>> '{}'", "cursor_at")
        .addSelect(
            (latest) =>
                latest
                    .select("d.decidedBy")
                    .from(DecisionEntity, "d")
                    .where("d.workspaceId = w.workspace_id AND d.workItemId = w.id")
                    .orderBy("d.createdAt", "DESC")
                    .addOrderBy("d.id", "DESC")
                    .limit(1),
            "decidedBy",
        )

/** A raw view row with the latest decider's name also under the name the contract gives the display name. */
const withDeciderName = (row: WorkItemViewRow): WorkItemViewRow => ({ ...row, deciderName: row.decidedBy ?? null })

/** The row of a waiting accounting item before its customer columns are folded into `lead`. */
type AccountingRawRow = Omit<AccountingWaitingWorkRow, "lead"> & {
    readonly lead_row_id: string | null
    readonly lead_contact_name: string
    readonly lead_company: string
    readonly lead_channel: string
}

@Injectable()
/** Reads the work items of a workspace as views: the item, its latest decision and, for accounting, its customer and staff member. */
export class WorkItemViewsService {
    /** Captures the primary entity manager. */
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One work item of the workspace, with the latest decision's name as `decidedBy` and `deciderName`; undefined when there is none. */
    async find(workspaceId: string, workItemId: string): Promise<WorkItemViewRow | undefined> {
        const row = await viewSelect(this.entityManager)
            .where("w.workspace_id = :workspaceId AND w.id = :workItemId", { workspaceId, workItemId })
            .limit(1)
            .getRawOne<WorkItemViewRow>()
        return row === undefined ? undefined : withDeciderName(row)
    }

    /** One page of the workspace's work items, newest first, keyset on (created_at, id). */
    async list(workspaceId: string, filter: WorkItemViewFilter): Promise<Array<WorkItemViewRow>> {
        const select = viewSelect(this.entityManager).where("w.workspace_id = :workspaceId", { workspaceId })
        if (filter.statuses.length > 0)
            select.andWhere("w.status IN (:...statuses)", { statuses: [...filter.statuses] })
        if (filter.after !== null) {
            select.andWhere("(w.created_at, w.id) < (CAST(:afterCreatedAt AS timestamptz), CAST(:afterId AS uuid))", {
                afterCreatedAt: filter.after.createdAt,
                afterId: filter.after.id,
            })
        }
        if (filter.action !== null) select.andWhere("w.action = :action", { action: filter.action })
        const rows = await select
            .orderBy("w.created_at", "DESC")
            .addOrderBy("w.id", "DESC")
            .limit(filter.limit)
            .getRawMany<WorkItemViewRow>()
        return rows.map(withDeciderName)
    }

    /** Waiting accounting work with its customer and assigned staff member, oldest first. */
    async accountingWaiting(workspaceId: string, limit: number): Promise<Array<AccountingWaitingWorkRow>> {
        const rows = await itemSelect(this.entityManager)
            .addSelect("l.id", "lead_row_id")
            .addSelect("l.contact_name", "lead_contact_name")
            .addSelect("l.company", "lead_company")
            .addSelect("l.channel", "lead_channel")
            .addSelect("s.name", "assigned_staff_name")
            .leftJoin("leads", "l", "l.id = w.lead_id AND l.workspace_id = w.workspace_id")
            .leftJoin("staff", "s", "s.id = w.assigned_staff_id AND s.workspace_id = w.workspace_id")
            .where("w.workspace_id = :workspaceId AND w.department = 'accounting' AND w.status = 'waiting_decision'", {
                workspaceId,
            })
            .orderBy("w.created_at", "ASC")
            .addOrderBy("w.id", "ASC")
            .limit(limit)
            .getRawMany<AccountingRawRow>()
        return rows.map(
            ({
                lead_row_id: id,
                lead_contact_name: contactName,
                lead_company: company,
                lead_channel: channel,
                ...item
            }) => ({
                ...item,
                lead: id === null ? null : { id, contact_name: contactName, company, channel },
            }),
        )
    }
}
