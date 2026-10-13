import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LoadOpenApiSpecQuery } from "../../application/load-open-api-spec.query"
import { LoadOpenApiSpecInput } from "./dto/load-open-api-spec.input"
import { OpenApiSpecType } from "./dto/open-api-spec.type"
import { toLoadOpenApiSpecRequest, toOpenApiSpecType } from "./load-open-api-spec.mapper"

@Resolver()
/** GraphQL door of loadOpenApiSpec. */
export class LoadOpenApiSpecResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the operations of an API spec from a link or pasted text; saves nothing. */
    @Query(() => OpenApiSpecType, { name: "loadOpenApiSpec" })
    async loadOpenApiSpec(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LoadOpenApiSpecInput,
    ): Promise<OpenApiSpecType> {
        const result = await this.queryBus.execute(
            new LoadOpenApiSpecQuery({ request: toLoadOpenApiSpecRequest(workspaceId, input), principal }),
        )
        return toOpenApiSpecType(result)
    }
}
