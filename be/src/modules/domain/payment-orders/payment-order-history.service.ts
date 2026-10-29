import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { PlanPaymentCounts } from "./payment-order-history.contracts"
import { PaymentOrderEntity } from "./persistence/entities"

@Injectable()
/** What a workspace already paid for its plan, counted from the settled orders. */
export class PaymentOrderHistoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The paid plan orders of the workspace at full price and at the intro price. */
    async planPaymentsOf(workspaceId: string): Promise<PlanPaymentCounts> {
        const row = await this.entityManager
            .createQueryBuilder(PaymentOrderEntity, "o")
            .select("count(*) FILTER (WHERE COALESCE(o.detail ->> 'promo', 'false') <> 'true')::int", "full_price")
            .addSelect("count(*) FILTER (WHERE o.detail ->> 'promo' = 'true')::int", "promo")
            .where("o.workspace_id = :workspaceId AND o.kind = 'plan' AND o.status = 'paid'", { workspaceId })
            .getRawOne<{ full_price: number; promo: number }>()
        return { fullPrice: row?.full_price ?? 0, promo: row?.promo ?? 0 }
    }
}
