import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { OrderTemplateListingCommand } from "../../application/order-template-listing.command"
import { TemplateOrderType } from "./dto/template-order.type"
import { OrderTemplateListingInput } from "./dto/order-template-listing.input"
import { toOrderTemplateListingRequest, toOrderTemplateListingType } from "./order-template-listing.mapper"

@Resolver()
/** GraphQL door of orderTemplateListing. */
export class OrderTemplateListingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Orders a paid listing: the transfer to make through SePay, the same way as any other order. */
    @Mutation(() => TemplateOrderType, { name: "orderTemplateListing" })
    async orderTemplateListing(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: OrderTemplateListingInput,
    ): Promise<TemplateOrderType> {
        const result = await this.commandBus.execute(
            new OrderTemplateListingCommand({ request: toOrderTemplateListingRequest(workspaceId, input), principal }),
        )
        return toOrderTemplateListingType(result)
    }
}
