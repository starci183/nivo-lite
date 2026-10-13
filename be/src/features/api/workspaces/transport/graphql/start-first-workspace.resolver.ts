import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartFirstWorkspaceCommand } from "../../application/start-first-workspace.command"
import { StartFirstWorkspaceType } from "./dto/start-first-workspace.type"
import { toStartFirstWorkspaceType } from "./start-first-workspace.mapper"

@Resolver()
/** GraphQL door of the first workspace a person gets at their first sign-in. */
export class StartFirstWorkspaceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates the caller's first workspace where free signup is allowed and they have none; answers a null id otherwise. */
    @Mutation(() => StartFirstWorkspaceType, { name: "startFirstWorkspace" })
    async startFirstWorkspace(@CurrentPrincipal() principal: Principal): Promise<StartFirstWorkspaceType> {
        const result = await this.commandBus.execute(new StartFirstWorkspaceCommand({ request: {}, principal }))
        return toStartFirstWorkspaceType(result)
    }
}
