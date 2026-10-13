import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ContentConfigurationQuery } from "../../application/content-configuration.query"
import { toContentConfigurationRequest, toContentConfigurationType } from "./content-configuration.mapper"
import { ContentConfigurationType } from "./dto/content-configuration.type"

@Resolver()
/** GraphQL door of contentConfiguration. */
export class ContentConfigurationResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** contentConfiguration for the selected workspace. */
    @Query(() => ContentConfigurationType, { name: "contentConfiguration" })
    async contentConfiguration(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ContentConfigurationType> {
        const result = await this.queryBus.execute(
            new ContentConfigurationQuery({
                request: toContentConfigurationRequest(workspaceId),
                principal,
            }),
        )
        return toContentConfigurationType(result)
    }
}
