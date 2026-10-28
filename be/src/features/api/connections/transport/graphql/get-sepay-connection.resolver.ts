import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetSepayConnectionQuery } from "../../application/get-sepay-connection.query"
import { GetSepayConnectionInput } from "./dto/get-sepay-connection.input"
import { SepayConnectionType } from "./dto/sepay-connection.type"
import { toGetSepayConnectionRequest, toSepayConnectionType } from "./get-sepay-connection.mapper"

@Resolver()
/** GraphQL door of sepayConnection. */
export class GetSepayConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the page read model of one SePay connection. */
    @Query(() => SepayConnectionType, { name: "sepayConnection" })
    async sepayConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetSepayConnectionInput,
    ): Promise<SepayConnectionType> {
        const result = await this.queryBus.execute(
            new GetSepayConnectionQuery({ request: toGetSepayConnectionRequest(workspaceId, input), principal }),
        )
        return toSepayConnectionType(result)
    }
}
