import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetProviderRightHoldersQuery } from "../../application/get-provider-right-holders.query"
import { GetProviderRightHoldersInput } from "./dto/get-provider-right-holders.input"
import { ProviderRightHoldersType } from "./dto/get-provider-right-holders.type"
import { toGetProviderRightHoldersRequest, toProviderRightHoldersType } from "./get-provider-right-holders.mapper"

@Resolver()
/** GraphQL door of providerRightHolders. */
export class GetProviderRightHoldersResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The rights tab of one connected account: every right of its provider with who holds it. Any member; read-only; no live provider call. */
    @Query(() => ProviderRightHoldersType, { name: "providerRightHolders" })
    async providerRightHolders(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetProviderRightHoldersInput,
    ): Promise<ProviderRightHoldersType> {
        const answer = await this.queryBus.execute(
            new GetProviderRightHoldersQuery({
                request: toGetProviderRightHoldersRequest(workspaceId, input),
                principal,
            }),
        )
        return toProviderRightHoldersType(answer)
    }
}
