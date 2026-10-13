import { QueryHandler } from "@nestjs/cqrs"
import { OpenApiWizardService } from "@modules/domain/data-hub"
import type { OpenApiConnectionView } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadOpenApiConnectionQuery } from "./load-open-api-connection.query"

@QueryHandler(LoadOpenApiConnectionQuery)
/** Reads a saved API connection through the OpenApiWizardService. */
export class LoadOpenApiConnectionHandler extends ICQRSHandler<LoadOpenApiConnectionQuery, OpenApiConnectionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: OpenApiWizardService,
    ) {
        super(logger)
    }

    protected override process(query: LoadOpenApiConnectionQuery): Promise<OpenApiConnectionView> {
        return this.wizard.load(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
