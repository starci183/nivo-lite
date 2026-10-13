import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveInventoryLocationCommand } from "../../application/save-inventory-location.command"
import { SaveInventoryLocationInput } from "./dto/save-inventory-location.input"
import { toSaveInventoryLocationRequest } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: create or rename one stock location. */
export class SaveInventoryLocationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or rename one stock location. */
    @Mutation(() => Boolean, { name: "saveInventoryLocation" })
    async saveInventoryLocation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveInventoryLocationInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SaveInventoryLocationCommand({
                request: toSaveInventoryLocationRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
