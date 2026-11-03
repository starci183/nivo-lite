import { QueryHandler } from "@nestjs/cqrs"
import { AgentTemplatesService } from "@modules/domain/agent-templates"
import type { PackagePreview } from "@nivo/agent-sdk/template"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewAgentTemplateQuery } from "./preview-agent-template.query"

@QueryHandler(PreviewAgentTemplateQuery)
/** Shows what packaging a version of an agent would keep and leave out, writing nothing. */
export class PreviewAgentTemplateHandler extends ICQRSHandler<PreviewAgentTemplateQuery, PackagePreview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplatesService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewAgentTemplateQuery): Promise<PackagePreview> {
        const p = query.params.principal.id
        const r = query.params.request
        return this.svc.preview(p, r)
    }
}
