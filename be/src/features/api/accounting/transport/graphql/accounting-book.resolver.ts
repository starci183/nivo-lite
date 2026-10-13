import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AccountingBookQuery } from "../../application/accounting-book.query"
import { AccountingBookType } from "./dto/accounting-book.type"
import { toAccountingBookType } from "./accounting-book.mapper"

@Resolver()
/** The GraphQL door for accountingBook. */
export class AccountingBookResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}
    /** Reads the selected workspace after the service proves the caller's membership. */
    @Query(() => AccountingBookType, { name: "accountingBook" })
    async accountingBook(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AccountingBookType> {
        const result = await this.queryBus.execute(new AccountingBookQuery({ request: { workspaceId }, principal }))
        return toAccountingBookType(result)
    }
}
