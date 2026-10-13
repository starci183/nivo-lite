import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBrainQuery } from "../../application/get-brain.query"
import { BrainType } from "./dto/brain.type"
import { toGetBrainRequest, toGetBrainType } from "./get-brain.mapper"

@Resolver()
/** GraphQL door of reads everything the Second Brain page shows. */
export class GetBrainResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads everything the Second Brain page shows. */
    @Query(() => BrainType, { name: "brain" })
    async brain(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<BrainType> {
        const result = await this.queryBus.execute(
            new GetBrainQuery({ request: toGetBrainRequest(workspaceId), principal }),
        )
        return toGetBrainType(result)
    }
}
