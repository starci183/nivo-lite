import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Connection, PageRequest } from "@modules/platform/pagination"
import type { SalesOrderView, SalesOrderViewLookup } from "./orders.contracts"
import { OrdersService } from "./orders.service"
import { toSalesOrderView } from "./orders-view.mapper"

@Injectable()
/** The authenticated read side of workspace sales orders. */
export class OrdersReadService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly orders: OrdersService,
    ) {}

    /** Proves membership before reading a single order. */
    async find(userId: string, workspaceId: string, orderId: string): Promise<SalesOrderViewLookup> {
        await this.members.require(userId, workspaceId)
        const order = await this.orders.find(workspaceId, orderId)
        return order === null ? null : toSalesOrderView(order)
    }

    /** Proves membership before listing the newest workspace orders. */
    async list(userId: string, workspaceId: string, request: PageRequest = {}): Promise<Connection<SalesOrderView>> {
        await this.members.require(userId, workspaceId)
        const orders = await this.orders.listPage(workspaceId, request)
        return { nodes: orders.nodes.map(toSalesOrderView), pageInfo: orders.pageInfo }
    }
}
