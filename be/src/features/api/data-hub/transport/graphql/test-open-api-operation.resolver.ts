import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TestOpenApiOperationQuery } from "../../application/test-open-api-operation.query"
import { OpenApiTestType } from "./dto/open-api-test.type"
import { TestOpenApiOperationInput } from "./dto/test-open-api-operation.input"
import { toOpenApiTestType, toTestOpenApiOperationRequest } from "./test-open-api-operation.mapper"

@Resolver()
/** GraphQL door of testOpenApiOperation. */
export class TestOpenApiOperationResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Tries one GET of an API with the typed settings; nothing is saved. */
    @Query(() => OpenApiTestType, { name: "testOpenApiOperation" })
    async testOpenApiOperation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TestOpenApiOperationInput,
    ): Promise<OpenApiTestType> {
        const result = await this.queryBus.execute(
            new TestOpenApiOperationQuery({ request: toTestOpenApiOperationRequest(workspaceId, input), principal }),
        )
        return toOpenApiTestType(result)
    }
}
