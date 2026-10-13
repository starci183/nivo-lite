import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetInstallationQuery } from "../../application/get-installation.query"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { ModuleInstallationIdInput } from "./dto/module-installation-id.input"
import { toGetInstallationRequest, toModuleInstallationType } from "./modules.mapper"

@Resolver()
/** GraphQL door of one installed agent. */
export class ModuleInstallationResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one installed agent of the workspace. */
    @Query(() => ModuleInstallationType, { name: "moduleInstallation" })
    async moduleInstallation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ModuleInstallationIdInput,
    ): Promise<ModuleInstallationType> {
        const result = await this.queryBus.execute(
            new GetInstallationQuery({ request: toGetInstallationRequest(workspaceId, input), principal }),
        )
        return toModuleInstallationType(result)
    }
}
