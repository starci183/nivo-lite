import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAccountQuery } from "../../application/get-account.query"
import { MyAccountType } from "./dto/my-account.type"
import { toMyAccountType } from "./my-account.mapper"

@Resolver()
/** GraphQL door of the caller's own account. */
export class MyAccountResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the profile, the linked sign-in methods and the devices signed in, the current one first. */
    @Query(() => MyAccountType, { name: "myAccount" })
    async myAccount(@CurrentPrincipal() principal: Principal): Promise<MyAccountType> {
        const result = await this.queryBus.execute(new GetAccountQuery({ request: {}, principal }))
        return toMyAccountType(result)
    }
}
