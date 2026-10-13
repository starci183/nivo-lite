import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateInventoryPoDraftCommand } from "../../application/update-inventory-po-draft.command"
import { UpdateInventoryPoDraftInput } from "./dto/update-inventory-po-draft.input"
import { toUpdateInventoryPoDraftRequest } from "./inventory-orders.mapper"

@Resolver()
/** GraphQL door: edit a draft purchase order. */
export class UpdateInventoryPoDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Edit a draft purchase order. */
    @Mutation(() => Boolean, { name: "updateInventoryPoDraft" })
    async updateInventoryPoDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateInventoryPoDraftInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new UpdateInventoryPoDraftCommand({
                request: toUpdateInventoryPoDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
