import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MyCreatorLedgerQuery } from "../../application/my-creator-ledger.query"
import { CreatorLedgerType } from "./dto/creator-ledger.type"
import { toMyCreatorLedgerType } from "./my-creator-ledger.mapper"

@Resolver()
/** GraphQL door of myCreatorLedger. */
export class MyCreatorLedgerResolver {
    constructor(@InjectQueryBus() private readonly bus: QueryBus) {}

    /** The ledger of what each sale owes the caller as a creator. Payouts are made by hand. */
    @Query(() => CreatorLedgerType, { name: "myCreatorLedger" })
    async myCreatorLedger(@CurrentPrincipal() principal: Principal): Promise<CreatorLedgerType> {
        const result = await this.bus.execute(new MyCreatorLedgerQuery({ request: {}, principal }))
        return toMyCreatorLedgerType(result)
    }
}
