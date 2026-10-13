import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetDraftingBlockedQuery } from "../../application/get-drafting-blocked.query"
import { toDraftingBlockedType } from "./get-drafting-blocked.mapper"

@Resolver()
/** GraphQL door for the content drafting policy. */
export class GetDraftingBlockedResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Indicates whether automated drafting is disabled by the owner. */
    @Query(() => Boolean, { name: "contentDraftingBlocked" })
    async contentDraftingBlocked(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        const result = await this.queryBus.execute(new GetDraftingBlockedQuery({ request: { workspaceId }, principal }))
        return toDraftingBlockedType(result)
    }
}
