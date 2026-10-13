import { Query } from "@nestjs/cqrs"
import type { OpenApiOperationTestResult } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TestOpenApiOperationRequest } from "./test-open-api-operation.contracts"

/** Tries one GET of an API with the typed settings. */
export class TestOpenApiOperationQuery extends Query<OpenApiOperationTestResult> {
    constructor(readonly params: ExecuteParams<TestOpenApiOperationRequest>) {
        super()
    }
}
