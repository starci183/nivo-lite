import type { OpenApiOperationTestResult } from "@modules/domain/data-hub"
import type { TestOpenApiOperationRequest } from "../../application/test-open-api-operation.contracts"
import type { OpenApiTestType } from "./dto/open-api-test.type"
import type { TestOpenApiOperationInput } from "./dto/test-open-api-operation.input"

/** Maps the GraphQL arguments of testOpenApiOperation to the request. */
export const toTestOpenApiOperationRequest = (
    workspaceId: string,
    input: TestOpenApiOperationInput,
): TestOpenApiOperationRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    baseUrl: input.baseUrl,
    auth: input.auth,
    op: input.op,
    fixedQuery: input.fixedQuery,
    itemsPath: input.itemsPath,
})

/** Maps the answer of testOpenApiOperation to the GraphQL type. */
export const toOpenApiTestType = (result: OpenApiOperationTestResult): OpenApiTestType => ({
    ...result,
    sampleKeys: [...result.sampleKeys],
})
