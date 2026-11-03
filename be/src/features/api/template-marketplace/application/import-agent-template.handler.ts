import { CommandHandler } from "@nestjs/cqrs"
import { AgentTemplateInstallerService } from "@modules/domain/agent-templates"
import type { InstalledTemplate } from "@nivo/agent-sdk/template"
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
        const p = command.params.principal.id
        const r = command.params.request
        return this.svc.install(p, {
            workspaceId: r.workspaceId,
            key: r.templateKey,
            version: r.version,
            values: r.values,
            name: r.name,
            locale: "vi",
            access: { kind: "private" },
        })
    }
}
