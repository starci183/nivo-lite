import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { LoadCrmConnectionQuery } from "../../application/load-crm-connection.query"
import { CrmConnectionViewType } from "./dto/crm-connection-view.type"
import { LoadCrmConnectionInput } from "./dto/load-crm-connection.input"
import { toCrmConnectionViewType, toLoadCrmConnectionRequest } from "./load-crm-connection.mapper"

@Resolver()
/** GraphQL door of crmConnection. */
export class LoadCrmConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a saved CRM connection for the provider page; never returns the key. */
    @Query(() => CrmConnectionViewType, { name: "crmConnection" })
    async crmConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadCrmConnectionInput,
    ): Promise<CrmConnectionViewType> {
        const result = await this.queryBus.execute(
            new LoadCrmConnectionQuery({ request: toLoadCrmConnectionRequest(workspaceId, input), principal }),
        )
        return toCrmConnectionViewType(result)
    }
}
