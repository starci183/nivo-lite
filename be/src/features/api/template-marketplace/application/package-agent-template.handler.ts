import { CommandHandler } from "@nestjs/cqrs"
import { AgentTemplatesService } from "@modules/domain/agent-templates"
import type { TemplateVersionView } from "@nivo-lite/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PackageAgentTemplateCommand } from "./package-agent-template.command"

@CommandHandler(PackageAgentTemplateCommand)
/** Packages a frozen version of an agent as the next version of a template of the caller. */
export class PackageAgentTemplateHandler extends ICQRSHandler<PackageAgentTemplateCommand, TemplateVersionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplatesService,
    ) {
        super(logger)
    }

    protected override process(command: PackageAgentTemplateCommand): Promise<TemplateVersionView> {
        const p = command.params.principal.id
        const r = command.params.request
        return this.svc.packageVersion(p, r)
    }
}
