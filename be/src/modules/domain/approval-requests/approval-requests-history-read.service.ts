import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ResolvedRequestLine, ResolvedRequestsFilter } from "./approval-requests-history-read.contracts"
import { ApprovalRequestEntity } from "./persistence/entities"

/** The instant a request counts at: when it ended, else when it was made. */
const REQUEST_AT = "COALESCE(r.resolvedAt, r.createdAt)"

@Injectable()
/** Request-time reads of ended approval requests for the decision history of other capabilities, always scoped to the workspace and bounded by the caller. */
export class ApprovalRequestsHistoryReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The ended requests of the workspace, newest first (ties by id, descending). */
    async resolvedPage(workspaceId: string, filter: ResolvedRequestsFilter): Promise<Array<ResolvedRequestLine>> {
        const select = this.entityManager
            .createQueryBuilder(ApprovalRequestEntity, "r")
            .where("r.workspaceId = :workspaceId AND r.status <> 'pending'", { workspaceId })
        if (filter.department !== null) select.andWhere("r.department = :department", { department: filter.department })
        if (filter.status !== null) select.andWhere("r.status = :status", { status: filter.status })
        const rows = await select
            .orderBy(REQUEST_AT, "DESC")
            .addOrderBy("r.id", "DESC")
            .offset(filter.skip)
            .limit(filter.limit)
            .getMany()
        return rows.flatMap((row) =>
            row.status === "pending"
                ? []
                : [
                      {
                          id: row.id,
                          department: row.department,
                          action: row.action,
                          status: row.status,
                          resolvedBy: row.resolvedBy,
                          chainStepId: row.chainStepId,
                          at: row.resolvedAt ?? row.createdAt,
                      },
                  ],
        )
    }
}
