import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetZaloConnectionQuery } from "../../application/get-zalo-connection.query"
import { GetZaloConnectionInput } from "./dto/get-zalo-connection.input"
import { ZaloWizardConnectionType } from "./dto/zalo-wizard-connection.type"
import { toGetZaloConnectionRequest, toGetZaloConnectionType } from "./get-zalo-connection.mapper"

@Resolver()
/** GraphQL door of zaloConnection. */
export class GetZaloConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the wizard view of a Zalo OA connection. */
    @Query(() => ZaloWizardConnectionType, { name: "zaloConnection" })
    async zaloConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetZaloConnectionInput,
    ): Promise<ZaloWizardConnectionType> {
        const result = await this.queryBus.execute(
            new GetZaloConnectionQuery({ request: toGetZaloConnectionRequest(workspaceId, input), principal }),
        )
        return toGetZaloConnectionType(result)
    }
}
