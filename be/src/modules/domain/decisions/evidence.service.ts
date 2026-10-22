import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import type { AccountingDecisionRow } from "./persistence/decision-log.rows"
import { INSERT_DECISION, LIST_ACCOUNTING_DECISIONS } from "./persistence/decision-log.sql"
import { LIST_LEAD_DECISION_HISTORY } from "./persistence/decision-history.sql"
import type { DecisionHistoryQuery, LeadDecisionRecord } from "./decision-history.contracts"

const jsonOrNull = (value: object | null | undefined): string | null =>
    value === null || value === undefined ? null : JSON.stringify(value)

@Injectable()
/** The two append-only logs: the evidence log of what happened and the decision log of who decided what. */
export class EvidenceService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly events: EventsService,
    ) {}

    /** Reads a bounded decision history after the composer proved workspace membership. */
    listDecisions(workspaceId: string, query: DecisionHistoryQuery): Promise<Array<LeadDecisionRecord>> {
        return this.entityManager.query<Array<LeadDecisionRecord>>(LIST_LEAD_DECISION_HISTORY, [
            workspaceId,
            query.leadId ?? null,
            query.humanDepartment ?? null,
            query.oldestFirst ?? false,
            Math.min(1000, Math.max(1, Math.floor(query.limit))),
        ])
    }

    /** The newest accounting decisions' lineage for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 500): Promise<Array<AccountingDecisionRow>> {
        return this.entityManager.query<Array<AccountingDecisionRow>>(LIST_ACCOUNTING_DECISIONS, [workspaceId, limit])
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
        await manager.query(INSERT_DECISION, [
            ctx.workspaceId,
            entry.work_item_id,
            entry.lead_id,
            entry.department,
            entry.action,
            entry.decided_by,
            entry.decider_kind,
            entry.outcome,
            entry.reason ?? null,
            entry.note ?? null,
            jsonOrNull(entry.before),
            jsonOrNull(entry.after),
            entry.decided_by_member_id ?? null,
        ])
    }
}
