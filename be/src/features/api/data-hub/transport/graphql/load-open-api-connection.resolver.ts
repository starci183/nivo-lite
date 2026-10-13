import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadOpenApiConnectionQuery } from "../../application/load-open-api-connection.query"
import { LoadOpenApiConnectionInput } from "./dto/load-open-api-connection.input"
import { OpenApiConnectionType } from "./dto/open-api-connection.type"
import { toLoadOpenApiConnectionRequest, toOpenApiConnectionType } from "./load-open-api-connection.mapper"

@Resolver()
/** GraphQL door of loadOpenApiConnection. */
export class LoadOpenApiConnectionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads a saved API connection for the wizard; never returns a secret. */
    @Query(() => OpenApiConnectionType, { name: "loadOpenApiConnection" })
    async loadOpenApiConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadOpenApiConnectionInput,
    ): Promise<OpenApiConnectionType> {
        const result = await this.queryBus.execute(
            new LoadOpenApiConnectionQuery({ request: toLoadOpenApiConnectionRequest(workspaceId, input), principal }),
        )
        return toOpenApiConnectionType(result)
    }
}
