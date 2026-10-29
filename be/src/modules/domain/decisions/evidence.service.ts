import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { LeadReadService } from "@modules/domain/leads"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import type { AccountingDecisionRow } from "./decision-log.rows"
import { DecisionEntity } from "./persistence/entities"
import type { DecisionHistoryQuery, LeadDecisionRecord } from "./decision-history.contracts"

@Injectable()
/** The two append-only logs: the evidence log of what happened and the decision log of who decided what. */
export class EvidenceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly events: EventsService,
        private readonly leads: LeadReadService,
        private readonly members: WorkspaceMemberDirectoryService,
    ) {}

    /** Reads a bounded decision history after the composer proved workspace membership. */
    async listDecisions(workspaceId: string, query: DecisionHistoryQuery): Promise<Array<LeadDecisionRecord>> {
        const oldestFirst = query.oldestFirst ?? false
        const read = this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id", "id")
            .addSelect("d.workItemId", "work_item_id")
            .addSelect("d.leadId", "lead_id")
            .addSelect("d.department", "department")
            .addSelect("d.action", "action")
            .addSelect("d.decidedBy", "decided_by")
            .addSelect("d.decidedByMemberId", "decidedByMemberId")
            .addSelect("d.deciderKind", "decider_kind")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.reason", "reason")
            .addSelect("d.note", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .where("d.workspaceId = :workspaceId", { workspaceId })
        if (query.leadId !== undefined) read.andWhere("d.leadId = :leadId", { leadId: query.leadId })
        if (query.humanDepartment !== undefined) {
            read.andWhere("d.department = :department AND d.deciderKind IN ('owner', 'staff')", {
                department: query.humanDepartment,
            })
        }
        const rows = await read
            .orderBy("d.createdAt", oldestFirst ? "ASC" : "DESC")
            .addOrderBy("d.id", "ASC")
            .limit(Math.min(1000, Math.max(1, Math.floor(query.limit))))
            .getRawMany<Omit<LeadDecisionRecord, "leadName">>()
        const leadIds = rows.flatMap((row) => (row.lead_id === null ? [] : [row.lead_id]))
        const memberIds = rows.flatMap((row) => (row.decidedByMemberId === null ? [] : [row.decidedByMemberId]))
        const names = new Map(
            (await this.leads.cardsOf(workspaceId, leadIds)).map((card) => [card.id, card.contactName]),
        )
        const members = new Map(
            (await this.members.byIds(workspaceId, [...new Set(memberIds)])).map((member) => [
                member.id,
                member.displayName,
            ]),
        )
        return rows.map((row) => ({
            ...row,
            leadName: row.lead_id === null ? null : (names.get(row.lead_id) ?? null),
            decided_by: members.get(row.decidedByMemberId ?? "") ?? row.decided_by,
        }))
    }

    /** The newest accounting decisions' lineage for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 500): Promise<Array<AccountingDecisionRow>> {
        return this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.id", "id")
            .addSelect("d.workItemId", "work_item_id")
            .addSelect("d.action", "action")
            .addSelect("d.decidedBy", "decided_by")
            .addSelect("d.deciderKind", "decider_kind")
            .addSelect("d.outcome", "outcome")
            .addSelect("d.note", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .where("d.workspaceId = :workspaceId AND d.department = 'accounting'", { workspaceId })
            .orderBy("d.createdAt", "DESC")
            .addOrderBy("d.id", "DESC")
            .limit(limit)
            .getRawMany<AccountingDecisionRow>()
    }

    /** Appends one line to the workspace's evidence log; the events capability is its only writer. */
    async log(ctx: WorkContext, entry: EvidenceEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await this.events.record(
            {
                workspaceId: ctx.workspaceId,
                kind: entry.kind,
                actor: entry.actor,
                summary: entry.summary,
                leadId: entry.lead_id ?? null,
                workItemId: entry.work_item_id ?? null,
                evidence: entry.evidence ?? null,
            },
            manager,
        )
    }

    /** Appends one line to the decision log: who decided, how (policy or person), the outcome and why. */
    async decide(ctx: WorkContext, entry: DecisionEntry, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.insert(DecisionEntity, {
            workspaceId: ctx.workspaceId,
            workItemId: entry.work_item_id,
            leadId: entry.lead_id,
            department: entry.department,
            action: entry.action,
            decidedBy: entry.decided_by,
            deciderKind: entry.decider_kind,
            outcome: entry.outcome,
            reason: entry.reason ?? null,
            note: entry.note ?? null,
            before: entry.before ?? null,
            after: entry.after ?? null,
            decidedByMemberId: entry.decided_by_member_id ?? null,
        })
    }
}
