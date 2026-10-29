import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OrderFigure } from "./orders-figures.contracts"
import { OrderEntity } from "./persistence/entities"

/** The most orders the governance figures read at once; the newest are kept. */
const FIGURES_LIMIT = 5000

@Injectable()
/** The dashboard counts and lists of a workspace's orders, always scoped to the workspace. */
export class OrdersFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many orders of the workspace were confirmed from the first instant (included) to the second (excluded). */
    countConfirmedBetween(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.entityManager
            .createQueryBuilder(OrderEntity, "o")
            .where("o.workspaceId = :workspaceId AND o.confirmedAt >= :from AND o.confirmedAt < :to", {
                workspaceId,
                from,
                to,
            })
            .getCount()
    }

    /** The orders that count for the governance figures: confirmed, invoiced or paid. */
    async confirmedOrBeyond(workspaceId: string): Promise<Array<OrderFigure>> {
        const orders = await this.entityManager.find(OrderEntity, {
            select: { id: true, leadId: true, orderNo: true, items: true, amountVnd: true, status: true },
            where: { workspaceId, status: In(["confirmed", "invoiced", "paid"]) },
            order: { createdAt: "DESC", id: "DESC" },
            take: FIGURES_LIMIT,
        })
        return orders.map((order) => ({
            id: order.id,
            leadId: order.leadId,
            orderNo: order.orderNo,
            items: order.items,
            amountVnd: order.amountVnd,
            status: order.status,
        }))
    }
}
