import { CommandHandler } from "@nestjs/cqrs"
import { TemplatePurchasesService } from "@modules/domain/template-marketplace"
import type { InstalledTemplate } from "@nivo-lite/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InstallTemplateListingCommand } from "./install-template-listing.command"

@CommandHandler(InstallTemplateListingCommand)
/** Installs an approved listing as a new agent in shadow mode; a paid one needs its settled order. */
export class InstallTemplateListingHandler extends ICQRSHandler<InstallTemplateListingCommand, InstalledTemplate> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplatePurchasesService,
    ) {
        super(logger)
    }

    protected override process(command: InstallTemplateListingCommand): Promise<InstalledTemplate> {
        return this.svc.install(command.params.principal.id, command.params.request)
    }
}
