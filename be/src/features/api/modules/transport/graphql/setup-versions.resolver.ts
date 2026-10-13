import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListSetupVersionsQuery } from "../../application/list-setup-versions.query"
import { SetupVersionsType } from "./dto/setup-versions.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { toListSetupVersionsRequest, toSetupVersionsType } from "./modules.mapper"

@Resolver()
/** GraphQL door of the context versions of an agent. */
export class SetupVersionsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The applied context versions of an installation, newest first, and the one in use. */
    @Query(() => SetupVersionsType, { name: "setupVersions" })
    async setupVersions(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<SetupVersionsType> {
        const result = await this.queryBus.execute(
            new ListSetupVersionsQuery({ request: toListSetupVersionsRequest(workspaceId, input), principal }),
        )
        return toSetupVersionsType(result)
    }
}
