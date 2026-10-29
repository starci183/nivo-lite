import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { ShiftsLeaveRequestEntity, ShiftsStaffEntity } from "./persistence/entities"
import type { ApprovedLeave, ApprovedLeaveQuery } from "./shifts-leave-read.contracts"

/** The most leave days one read answers. */
const LEAVE_LIMIT = 500

const isLeaveRow = (value: unknown): value is { staff_id: string; from_date: string; to_date: string } =>
    isRecord(value) &&
    typeof value.staff_id === "string" &&
    typeof value.from_date === "string" &&
    typeof value.to_date === "string"

@Injectable()
/** Leave reads for other capabilities (the booking calendar blocks the days its staff are off). */
export class ShiftsLeaveReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The approved leave of the given staff members that touches the window, at most 500 rows; none for no staff. */
    async approvedLeave(query: ApprovedLeaveQuery): Promise<Array<ApprovedLeave>> {
        if (query.staffIds.length === 0) return []
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(ShiftsLeaveRequestEntity, "l")
            .select("p.staff_id", "staff_id")
            .addSelect("CAST(l.from_date AS text)", "from_date")
            .addSelect("CAST(l.to_date AS text)", "to_date")
            .innerJoin(ShiftsStaffEntity, "p", "p.id = l.staffId AND p.workspace_id = l.workspaceId")
            .where("l.workspaceId = :workspaceId", { workspaceId: query.workspaceId })
            .andWhere("p.staff_id IN (:...staffIds)", { staffIds: query.staffIds })
            .andWhere(
                "l.status = 'approved' AND l.from_date <= CAST(:to AS date) AND l.to_date >= CAST(:from AS date)",
                {
                    from: query.from,
                    to: query.to,
                },
            )
            .limit(LEAVE_LIMIT)
            .getRawMany()
        return rows
            .filter(isLeaveRow)
            .map((row) => ({ staffId: row.staff_id, fromDate: row.from_date, toDate: row.to_date }))
    }
}
