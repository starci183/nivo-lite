import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentFiguresQuery } from "../../application/content-figures.query"
import { toContentFiguresType } from "./content-figures.mapper"
import { ContentFiguresType } from "./dto/content-figures.type"

@Resolver()
/** The GraphQL door for contentFigures. */
export class GetContentFiguresResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The counts and next scheduled post of the content workbench. */
    @Query(() => ContentFiguresType, { name: "contentFigures" })
    async contentFigures(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ContentFiguresType> {
        const result = await this.queryBus.execute(new GetContentFiguresQuery({ request: { workspaceId }, principal }))
        return toContentFiguresType(result)
    }
}
