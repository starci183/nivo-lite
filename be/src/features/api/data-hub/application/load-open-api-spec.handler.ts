import { QueryHandler } from "@nestjs/cqrs"
import { OpenApiWizardService } from "@modules/domain/data-hub"
import type { OpenApiSpecLoaded } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadOpenApiSpecQuery } from "./load-open-api-spec.query"

@QueryHandler(LoadOpenApiSpecQuery)
/** Reads an API spec through the OpenApiWizardService. */
export class LoadOpenApiSpecHandler extends ICQRSHandler<LoadOpenApiSpecQuery, OpenApiSpecLoaded> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: OpenApiWizardService,
    ) {
        super(logger)
    }

    protected override process(query: LoadOpenApiSpecQuery): Promise<OpenApiSpecLoaded> {
        return this.wizard.loadSpec(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
