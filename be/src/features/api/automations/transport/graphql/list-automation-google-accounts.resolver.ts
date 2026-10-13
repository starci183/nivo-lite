import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListGoogleAccountsQuery } from "../../application/list-google-accounts.query"
import { AutomationGoogleAccountType } from "./dto/google-account.type"
import { toAutomationGoogleAccountTypes } from "./list-automation-google-accounts.mapper"

@Resolver()
/** GraphQL door of the Google accounts a spreadsheet automation can write with. */
export class ListAutomationGoogleAccountsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the Google accounts a spreadsheet automation can write with. */
    @Query(() => [AutomationGoogleAccountType], { name: "automationGoogleAccounts" })
    async automationGoogleAccounts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<AutomationGoogleAccountType>> {
        const result = await this.queryBus.execute(
            new ListGoogleAccountsQuery({ request: { workspaceId }, principal }),
        )
        return toAutomationGoogleAccountTypes(result)
    }
}
