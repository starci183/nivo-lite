import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateResponsibilityCommand } from "../../application/create-responsibility.command"
import { ResponsibilityType } from "./dto/responsibility.type"
import { CreateResponsibilityInput } from "./dto/create-responsibility.input"
import { toCreateResponsibilityRequest, toResponsibilityType } from "./decisions.mapper"

@Resolver()
/** GraphQL door that adds a responsibility. */
export class CreateResponsibilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds a responsibility for a customer. */
    @Mutation(() => ResponsibilityType, { name: "createResponsibility" })
    async createResponsibility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateResponsibilityInput,
    ): Promise<ResponsibilityType> {
        const result = await this.commandBus.execute(
            new CreateResponsibilityCommand({ request: toCreateResponsibilityRequest(workspaceId, input), principal }),
        )
        return toResponsibilityType(result)
    }
}
