import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AutomationOrderFigures, AutomationOrderRead } from "./orders-automation-read.contracts"
import { OrderEntity } from "./persistence/entities"

@Injectable()
/** The order reads the automations make: one order for the delivery notice and the confirmed figures of the day report. */
export class OrdersAutomationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** One order of a workspace, or none. */
    order(workspaceId: string, orderId: string): Promise<AutomationOrderRead | undefined> {
        return this.entityManager
            .createQueryBuilder(OrderEntity, "o")
            .select([
                "o.id AS id",
                "o.order_no AS order_no",
                "o.lead_id AS lead_id",
                "o.shipped_at AS shipped_at",
                "o.carrier AS carrier",
                "o.tracking_code AS tracking_code",
            ])
            .where("o.workspace_id = :workspaceId AND o.id = :orderId", { workspaceId, orderId })
            .limit(1)
            .getRawOne<AutomationOrderRead>()
    }

    /** The orders confirmed from an instant on and not cancelled, read through the transaction of the caller. */
    async confirmedSince(workspaceId: string, start: string, manager: EntityManager): Promise<AutomationOrderFigures> {
        const row = await manager
            .createQueryBuilder(OrderEntity, "o")
            .select("count(*)::int", "count")
            .addSelect("coalesce(sum(o.amount_vnd), 0)::bigint", "total")
            .where("o.workspace_id = :workspaceId AND o.confirmed_at >= :start AND o.status <> 'cancelled'", {
                workspaceId,
                start,
            })
            .getRawOne<AutomationOrderFigures>()
        return { count: row?.count ?? 0, total: row?.total ?? 0 }
    }
}
