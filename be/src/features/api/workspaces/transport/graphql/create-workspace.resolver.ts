import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateWorkspaceCommand } from "../../application/create-workspace.command"
import { toCreateWorkspaceRequest, toCreateWorkspaceType } from "./create-workspace.mapper"
import { CreateWorkspaceInput } from "./dto/create-workspace.input"
import { CreateWorkspaceType } from "./dto/create-workspace.type"

@Resolver()
/** GraphQL door of workspace creation. */
export class CreateWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a free workspace owned by the caller, where the environment allows it. */
    @Mutation(() => CreateWorkspaceType, { name: "createWorkspace" })
    async createWorkspace(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: CreateWorkspaceInput,
    ): Promise<CreateWorkspaceType> {
        const result = await this.commandBus.execute(
            new CreateWorkspaceCommand({ request: toCreateWorkspaceRequest(input), principal }),
        )
        return toCreateWorkspaceType(result)
    }
}
