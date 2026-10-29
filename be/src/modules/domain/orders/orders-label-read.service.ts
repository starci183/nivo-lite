import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OrderNumber } from "./orders-label-read.contracts"
import { OrderEntity } from "./persistence/entities"

@Injectable()
/** Request-time reads of the numbers orders show, for other capabilities that name an order next to their own record; scoped to the workspace and bounded by the ids. */
export class OrdersLabelReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The number of each given order of the workspace; an order that does not exist is missing. */
    async numbersOf(workspaceId: string, orderIds: ReadonlyArray<string>): Promise<Array<OrderNumber>> {
        if (orderIds.length === 0) return []
        const rows = await this.entityManager.find(OrderEntity, {
            select: { id: true, orderNo: true },
            where: { workspaceId, id: In([...new Set(orderIds)]) },
            take: orderIds.length,
        })
        return rows.map((row) => ({ id: row.id, orderNo: row.orderNo }))
    }
}
