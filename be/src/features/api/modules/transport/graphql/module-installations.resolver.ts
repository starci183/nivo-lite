import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListInstallationsQuery } from "../../application/list-installations.query"
import { ModuleInstallationType } from "./dto/module-installation.type"
import { toListInstallationsRequest, toModuleInstallationsType } from "./modules.mapper"

@Resolver()
/** GraphQL door of the installed agents. */
export class ModuleInstallationsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists every installed agent of the workspace, oldest first. */
    @Query(() => [ModuleInstallationType], { name: "moduleInstallations" })
    async moduleInstallations(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<ModuleInstallationType>> {
        const result = await this.queryBus.execute(
            new ListInstallationsQuery({ request: toListInstallationsRequest(workspaceId), principal }),
        )
        return toModuleInstallationsType(result)
    }
}
