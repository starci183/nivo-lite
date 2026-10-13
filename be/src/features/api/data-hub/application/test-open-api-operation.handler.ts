import { QueryHandler } from "@nestjs/cqrs"
import { OpenApiWizardService } from "@modules/domain/data-hub"
import type { OpenApiOperationTestResult } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TestOpenApiOperationQuery } from "./test-open-api-operation.query"

@QueryHandler(TestOpenApiOperationQuery)
/** Tries one GET of an API through the OpenApiWizardService; nothing is saved. */
export class TestOpenApiOperationHandler extends ICQRSHandler<TestOpenApiOperationQuery, OpenApiOperationTestResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: OpenApiWizardService,
    ) {
        super(logger)
    }

    protected override process(query: TestOpenApiOperationQuery): Promise<OpenApiOperationTestResult> {
        return this.wizard.testOperation(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
