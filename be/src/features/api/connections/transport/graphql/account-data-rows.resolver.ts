import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { AccountDataRowsQuery, AccountDataTypesQuery } from "../../application/account-data-rows.queries"
import {
    toAccountDataRowsRequest,
    toAccountDataRowsType,
    toAccountDataTypesRequest,
    toAccountDataTypesType,
} from "./account-data-rows.mapper"
import { AccountDataRowsInput, AccountDataTypesInput } from "./dto/account-data-rows.input"
import { AccountDataRowsType, AccountDataTypeType } from "./dto/account-data-rows.type"

@Resolver()
/** GraphQL door of accountDataTypes and accountDataRows. */
export class AccountDataRowsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The declared data types a connected account stores (owner or manager). */
    @Query(() => [AccountDataTypeType], { name: "accountDataTypes" })
    async accountDataTypes(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AccountDataTypesInput,
    ): Promise<Array<AccountDataTypeType>> {
        return toAccountDataTypesType(
            await this.queryBus.execute(
                new AccountDataTypesQuery({ request: toAccountDataTypesRequest(workspaceId, input), principal }),
            ),
        )
    }

    /** The newest rows of one declared data type of a connected account (owner or manager). */
    @Query(() => AccountDataRowsType, { name: "accountDataRows" })
    async accountDataRows(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AccountDataRowsInput,
    ): Promise<AccountDataRowsType> {
        return toAccountDataRowsType(
            await this.queryBus.execute(
                new AccountDataRowsQuery({ request: toAccountDataRowsRequest(workspaceId, input), principal }),
            ),
        )
    }
}
