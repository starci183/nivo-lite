import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListGoogleAccountsQuery } from "../../application/list-google-accounts.query"
import { GoogleAccountType } from "./dto/google-account.type"
import { toListGoogleAccountsRequest, toListGoogleAccountsType } from "./list-google-accounts.mapper"

@Resolver()
/** GraphQL door of googleAccounts. */
export class ListGoogleAccountsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the live Google accounts of the workspace. */
    @Query(() => [GoogleAccountType], { name: "googleAccounts" })
    async googleAccounts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<GoogleAccountType>> {
        const result = await this.queryBus.execute(
            new ListGoogleAccountsQuery({ request: toListGoogleAccountsRequest(workspaceId), principal }),
        )
        return toListGoogleAccountsType(result)
    }
}
