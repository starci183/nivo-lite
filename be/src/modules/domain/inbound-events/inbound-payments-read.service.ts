import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { UnmatchedPayments } from "./inbound-payments-read.contracts"
import { InboundEventEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of received payments for the cash reports of other capabilities, scoped to the workspace and bounded by the caller. */
export class InboundPaymentsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The payments received that still wait for a decision: their count and total, and the oldest `limit` of them. */
    async unmatched(workspaceId: string, limit: number): Promise<UnmatchedPayments> {
        const waiting = () =>
            this.entityManager
                .createQueryBuilder(InboundEventEntity, "e")
                .where("e.workspaceId = :workspaceId AND e.kind = 'payment' AND e.status = 'needs_decision'", {
                    workspaceId,
                })
        const tally = await waiting()
            .select("count(*)::int", "count")
            .addSelect("coalesce(sum(e.amountVnd), 0)::float8", "total")
            .getRawOne<{ count: number; total: number }>()
        const rows = await waiting().orderBy("e.createdAt", "ASC").limit(limit).getMany()
        return {
            count: tally?.count ?? 0,
            total: tally?.total ?? 0,
            items: rows.map((row) => ({
                amountVnd: Number(row.amountVnd ?? 0),
                senderName: row.senderName,
                memo: row.externalRef ?? row.body,
            })),
        }
    }
}
