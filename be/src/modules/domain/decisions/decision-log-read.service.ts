import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { DecisionLogFilter } from "./decision-history.contracts"
import type { DecisionLogRow } from "./decision-log.rows"
import { DecisionEntity } from "./persistence/entities"

/** Postgres text of the instant that sorts like the instant: fixed width, UTC, to the microsecond. */
const SORT_KEY = "YYYYMMDDHH24MISS.US"

@Injectable()
/** Reads the lines of the decision log of a workspace, newest first. */
export class DecisionLogReadService {
    /** Captures the primary entity manager the decision log is read through. */
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest `limit` lines of the decision log that pass the filter; each carries its `sort_key` at full precision. */
    lines(workspaceId: string, filter: DecisionLogFilter): Promise<Array<DecisionLogRow>> {
        const select = this.entityManager
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
            .addSelect("COALESCE(d.note, '')", "note")
            .addSelect("to_json(d.createdAt) #>> '{}'", "created_at")
            .addSelect(`to_char(d.createdAt AT TIME ZONE 'UTC', '${SORT_KEY}')`, "sort_key")
            .where("d.workspaceId = :workspaceId", { workspaceId })
        if (filter.deciders !== null)
            select.andWhere("d.deciderKind IN (:...deciders)", { deciders: [...filter.deciders] })
        if (filter.outcome !== null) select.andWhere("d.outcome = :outcome", { outcome: filter.outcome })
        if (filter.department !== null) select.andWhere("d.department = :department", { department: filter.department })
        return select
            .orderBy("d.createdAt", "DESC")
            .addOrderBy("d.id", "DESC")
            .limit(filter.limit)
            .getRawMany<DecisionLogRow>()
    }
}
