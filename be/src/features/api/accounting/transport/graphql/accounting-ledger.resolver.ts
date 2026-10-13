import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AccountingLedgerQuery } from "../../application/accounting-ledger.query"
import { AccountingLedgerEntryType } from "./dto/accounting-ledger-entry.type"
import { toAccountingLedgerType } from "./accounting-ledger.mapper"

@Resolver()
/** The GraphQL door for accountingLedger. */
export class AccountingLedgerResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}
    /** Reads the selected workspace after the service proves the caller's membership. */
    @Query(() => [AccountingLedgerEntryType], { name: "accountingLedger" })
    async accountingLedger(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ReadonlyArray<AccountingLedgerEntryType>> {
        const result = await this.queryBus.execute(new AccountingLedgerQuery({ request: { workspaceId }, principal }))
        return toAccountingLedgerType(result)
    }
}
