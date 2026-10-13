import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AccountingWorkbenchQuery } from "../../application/accounting-workbench.query"
import { AccountingWorkbenchType } from "./dto/accounting-workbench.type"
import { toAccountingWorkbenchType } from "./accounting-workbench.mapper"

@Resolver()
/** The GraphQL door for accountingWorkbench. */
export class AccountingWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}
    /** Reads the selected workspace after the service proves the caller's membership. */
    @Query(() => AccountingWorkbenchType, { name: "accountingWorkbench" })
    async accountingWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AccountingWorkbenchType> {
        const result = await this.queryBus.execute(
            new AccountingWorkbenchQuery({ request: { workspaceId }, principal }),
        )
        return toAccountingWorkbenchType(result)
    }
}
