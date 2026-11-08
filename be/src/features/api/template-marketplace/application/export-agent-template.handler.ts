import { QueryHandler } from "@nestjs/cqrs"
import { AgentTemplatesService } from "@modules/domain/agent-templates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ExportAgentTemplateQuery } from "./export-agent-template.query"

@QueryHandler(ExportAgentTemplateQuery)
/** Exports one version of a template of the caller as a file of canonical JSON. */
export class ExportAgentTemplateHandler extends ICQRSHandler<ExportAgentTemplateQuery, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplatesService,
    ) {
        super(logger)
    }

    protected override process(query: ExportAgentTemplateQuery): Promise<string> {
        return this.svc.exportFile(
            query.params.principal.id,
            query.params.request.templateKey,
            query.params.request.version,
        )
    }
}
