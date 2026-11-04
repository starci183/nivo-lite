import { CommandHandler } from "@nestjs/cqrs"
import { AgentTemplateInstallerService } from "@modules/domain/agent-templates"
import type { InstalledTemplate } from "@nivo-lite/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ImportAgentTemplateCommand } from "./import-agent-template.command"

@CommandHandler(ImportAgentTemplateCommand)
/** Installs a template of the caller's own account as a new agent in this workspace, in shadow mode. */
export class ImportAgentTemplateHandler extends ICQRSHandler<ImportAgentTemplateCommand, InstalledTemplate> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplateInstallerService,
    ) {
        super(logger)
    }

    protected override process(command: ImportAgentTemplateCommand): Promise<InstalledTemplate> {
        return this.svc.importOwn(command.params.principal.id, command.params.request)
    }
}
