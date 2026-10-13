import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { InventoryTemplatesQuery } from "../../application/inventory-templates.query"
import { InventoryTemplateType } from "./dto/inventory-template.type"
import { toInventoryTemplatesRequest, toInventoryTemplateType } from "./inventory-workbench.mapper"

@Resolver()
/** GraphQL door: the starter sets a new shop can pick. */
export class InventoryTemplatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The starter sets a new shop can pick. */
    @Query(() => [InventoryTemplateType], { name: "inventoryTemplates" })
    async inventoryTemplates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<InventoryTemplateType>> {
        const result = await this.queryBus.execute(
            new InventoryTemplatesQuery({ request: toInventoryTemplatesRequest(workspaceId), principal }),
        )
        return toInventoryTemplateType(result)
    }
}
