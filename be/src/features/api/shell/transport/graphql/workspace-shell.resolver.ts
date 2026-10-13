import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetShellQuery } from "../../application/get-shell.query"
import { ShellWindowInput } from "./dto/shell-window.input"
import { WorkspaceShellType } from "./dto/workspace-shell.type"
import { toGetShellRequest, toWorkspaceShellType } from "./workspace-shell.mapper"

@Resolver()
/** GraphQL door of the console frame facts. */
export class WorkspaceShellResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads everything the console frame draws for the caller's workspace in one request. */
    @Query(() => WorkspaceShellType, { name: "workspaceShell" })
    async workspaceShell(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShellWindowInput,
    ): Promise<WorkspaceShellType> {
        const result = await this.queryBus.execute(
            new GetShellQuery({ request: toGetShellRequest(workspaceId, input), principal }),
        )
        return toWorkspaceShellType(result)
    }
}
