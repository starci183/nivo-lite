import { CommandHandler } from "@nestjs/cqrs"
import { OpenApiWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveOpenApiConnectionCommand } from "./save-open-api-connection.command"

@CommandHandler(SaveOpenApiConnectionCommand)
/** Saves an API connection through the OpenApiWizardService. */
export class SaveOpenApiConnectionHandler extends ICQRSHandler<SaveOpenApiConnectionCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: OpenApiWizardService,
    ) {
        super(logger)
    }

    protected override process(command: SaveOpenApiConnectionCommand): Promise<string> {
        return this.wizard.save(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request,
        )
    }
}
