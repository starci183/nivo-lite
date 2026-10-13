import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentWorkbenchQuery } from "../../application/content-workbench.query"
import { toContentWorkbenchType } from "./content-workbench.mapper"
import { ContentWorkbenchType } from "./dto/content-workbench.type"

@Resolver()
/** The GraphQL door for contentWorkbench. */
export class GetContentWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The core content workbench data of the caller's workspace. */
    @Query(() => ContentWorkbenchType, { name: "contentWorkbench" })
    async contentWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ContentWorkbenchType> {
        const result = await this.queryBus.execute(
            new GetContentWorkbenchQuery({ request: { workspaceId }, principal }),
        )
        return toContentWorkbenchType(result)
    }
}
