import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { InventoryWorkbenchQuery } from "../../application/inventory-workbench.query"
import { InventoryWorkbenchType } from "./dto/inventory-workbench.type"
import { toInventoryWorkbenchRequest, toInventoryWorkbenchType } from "./inventory-workbench.mapper"

@Resolver()
/** GraphQL door: the whole inventory workbench of the caller's workspace. */
export class InventoryWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The whole inventory workbench of the caller's workspace. */
    @Query(() => InventoryWorkbenchType, { name: "inventoryWorkbench" })
    async inventoryWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<InventoryWorkbenchType> {
        const result = await this.queryBus.execute(
            new InventoryWorkbenchQuery({ request: toInventoryWorkbenchRequest(workspaceId), principal }),
        )
        return toInventoryWorkbenchType(result)
    }
}
