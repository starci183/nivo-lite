import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingStorageQuery } from "../../application/billing-storage.query"
import { BillingStorageType } from "./dto/billing-storage.type"
import { toBillingStorageRequest, toBillingStorageType } from "./billing-storage.mapper"

@Resolver()
/** GraphQL door for billingStorage. */
export class BillingStorageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the storage kept by the selected workspace. */
    @Query(() => BillingStorageType, { name: "billingStorage" })
    async billingStorage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<BillingStorageType> {
        const result = await this.queryBus.execute(
            new BillingStorageQuery({ request: toBillingStorageRequest(workspaceId), principal }),
        )
        return toBillingStorageType(result)
    }
}
