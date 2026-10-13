import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListCreditPacksQuery } from "../../application/list-credit-packs.query"
import { toCreditPacksType } from "./credit-packs.mapper"
import { CreditPackType } from "./dto/credit-pack.type"

@Resolver()
/** The GraphQL door for credit packs. */
export class CreditPacksResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads credit packs through its application handler. */
    @Query(() => [CreditPackType], { name: "creditPacks" })
    async creditPacks(@CurrentPrincipal() principal: Principal): Promise<Array<CreditPackType>> {
        const result = await this.queryBus.execute(new ListCreditPacksQuery({ request: {}, principal }))
        return toCreditPacksType(result)
    }
}
