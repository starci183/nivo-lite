import { CommandHandler } from "@nestjs/cqrs"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import type { ContentBrandSettings } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveContentBrandCommand } from "./save-content-brand.command"

@CommandHandler(SaveContentBrandCommand)
/** Delegates saveContentBrand to the workspace configuration capability. */
export class SaveContentBrandHandler extends ICQRSHandler<SaveContentBrandCommand, ContentBrandSettings> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(command: SaveContentBrandCommand): Promise<ContentBrandSettings> {
        return this.configuration.saveBrand(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.brand,
        )
    }
}
