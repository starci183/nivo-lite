import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetInventoryItemActiveCommand } from "../../application/set-inventory-item-active.command"
import { SetInventoryItemActiveInput } from "./dto/set-inventory-item-active.input"
import { toSetInventoryItemActiveRequest } from "./inventory-catalog.mapper"

@Resolver()
/** GraphQL door: switch a catalogue item on or off. */
export class SetInventoryItemActiveResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Switch a catalogue item on or off. */
    @Mutation(() => Boolean, { name: "setInventoryItemActive" })
    async setInventoryItemActive(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetInventoryItemActiveInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SetInventoryItemActiveCommand({
                request: toSetInventoryItemActiveRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
