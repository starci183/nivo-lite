import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PromoStateQuery } from "../../application/promo-state.query"
import { toPromoStateRequest, toPromoStateType } from "./promo-state.mapper"
import { PromoStateType } from "./dto/promo-state.type"

@Resolver()
/** GraphQL read door for promoState. */
export class PromoStateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads promoState from the caller's selected workspace. */
    @Query(() => PromoStateType, { name: "promoState" })
    async promoState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<PromoStateType> {
        const result = await this.queryBus.execute(
            new PromoStateQuery({ request: toPromoStateRequest(workspaceId), principal }),
        )
        return toPromoStateType(result)
    }
}
