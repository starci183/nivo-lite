import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApplyInventoryStarterCommand } from "../../application/apply-inventory-starter.command"
import { ApplyStarterType } from "./dto/apply-starter.type"
import { ApplyInventoryStarterInput } from "./dto/apply-inventory-starter.input"
import { toApplyInventoryStarterRequest, toApplyStarterType } from "./inventory-import.mapper"

@Resolver()
/** GraphQL door: load one starter set of suppliers, items and recipes. */
export class ApplyInventoryStarterResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Load one starter set of suppliers, items and recipes. */
    @Mutation(() => ApplyStarterType, { name: "applyInventoryStarter" })
    async applyInventoryStarter(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApplyInventoryStarterInput,
    ): Promise<ApplyStarterType> {
        const result = await this.commandBus.execute(
            new ApplyInventoryStarterCommand({
                request: toApplyInventoryStarterRequest(workspaceId, input),
                principal,
            }),
        )
        return toApplyStarterType(result)
    }
}
