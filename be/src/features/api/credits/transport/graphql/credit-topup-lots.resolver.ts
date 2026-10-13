import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListCreditTopupLotsQuery } from "../../application/list-credit-topup-lots.query"
import { toCreditTopupLotsRequest, toCreditTopupLotsType } from "./credit-topup-lots.mapper"
import { CreditTopupLotType } from "./dto/credit-topup-lot.type"

@Resolver()
/** The GraphQL door for credit topup lots. */
export class CreditTopupLotsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads credit topup lots through its application handler. */
    @Query(() => [CreditTopupLotType], { name: "creditTopupLots" })
    async creditTopupLots(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<CreditTopupLotType>> {
        const result = await this.queryBus.execute(
            new ListCreditTopupLotsQuery({ request: toCreditTopupLotsRequest(workspaceId), principal }),
        )
        return toCreditTopupLotsType(result)
    }
}
