import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListCreditPacksBoughtQuery } from "../../application/list-credit-packs-bought.query"
import { toCreditPacksBoughtRequest, toCreditPacksBoughtType } from "./credit-packs-bought.mapper"
import { CreditPackPurchaseType } from "./dto/credit-pack-purchase.type"

@Resolver()
/** The GraphQL door for the add-on packs bought this month. */
export class CreditPacksBoughtResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the add-on packs the selected workspace paid for this month. */
    @Query(() => [CreditPackPurchaseType], { name: "creditPacksBought" })
    async creditPacksBought(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<CreditPackPurchaseType>> {
        const result = await this.queryBus.execute(
            new ListCreditPacksBoughtQuery({ request: toCreditPacksBoughtRequest(workspaceId), principal }),
        )
        return toCreditPacksBoughtType(result)
    }
}
