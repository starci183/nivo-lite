import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCreditQuotaStatusQuery } from "../../application/get-credit-quota-status.query"
import { toCreditQuotaStatusRequest, toCreditQuotaStatusType } from "./credit-quota-status.mapper"
import { CreditQuotaStatusType } from "./dto/credit-quota-status.type"

@Resolver()
/** The GraphQL door for credit quota status. */
export class CreditQuotaStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads this month's quota through its application handler. */
    @Query(() => CreditQuotaStatusType, { name: "creditQuotaStatus", nullable: true })
    async creditQuotaStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<CreditQuotaStatusType | null> {
        const result = await this.queryBus.execute(
            new GetCreditQuotaStatusQuery({ request: toCreditQuotaStatusRequest(workspaceId), principal }),
        )
        return toCreditQuotaStatusType(result)
    }
}
