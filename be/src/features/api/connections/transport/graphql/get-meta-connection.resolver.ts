import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetMetaConnectionQuery } from "../../application/get-meta-connection.query"
import { GetMetaConnectionInput } from "./dto/get-meta-connection.input"
import { MetaWizardConnectionType } from "./dto/meta-wizard-connection.type"
import { toGetMetaConnectionRequest, toGetMetaConnectionType } from "./get-meta-connection.mapper"

@Resolver()
/** GraphQL door of metaConnection. */
export class GetMetaConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the wizard view of a Meta connection. */
    @Query(() => MetaWizardConnectionType, { name: "metaConnection" })
    async metaConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetMetaConnectionInput,
    ): Promise<MetaWizardConnectionType> {
        const result = await this.queryBus.execute(
            new GetMetaConnectionQuery({ request: toGetMetaConnectionRequest(workspaceId, input), principal }),
        )
        return toGetMetaConnectionType(result)
    }
}
