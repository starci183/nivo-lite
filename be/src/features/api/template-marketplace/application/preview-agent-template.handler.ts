import { QueryHandler } from "@nestjs/cqrs"
import { AgentTemplatesService, type PackagePreviewView } from "@modules/domain/agent-templates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { PreviewAgentTemplateQuery } from "./preview-agent-template.query"

@QueryHandler(PreviewAgentTemplateQuery)
/** Shows what packaging a version of an agent would keep and leave out, writing nothing. */
export class PreviewAgentTemplateHandler extends ICQRSHandler<PreviewAgentTemplateQuery, PackagePreviewView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplatesService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewAgentTemplateQuery): Promise<PackagePreviewView> {
        return this.svc.previewDraft(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.input,
        )
    }
}
