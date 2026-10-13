import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentActorQuery } from "../../application/content-actor.query"
import { toContentActorType } from "./content-actor.mapper"
import { ContentActorType } from "./dto/content-actor.type"

@Resolver()
/** The GraphQL door for contentActor. */
export class GetContentActorResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The signed-in member and their content permissions. */
    @Query(() => ContentActorType, { name: "contentActor" })
    async contentActor(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ContentActorType> {
        const result = await this.queryBus.execute(new GetContentActorQuery({ request: { workspaceId }, principal }))
        return toContentActorType(result)
    }
}
