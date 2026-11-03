import { QueryHandler } from "@nestjs/cqrs"
import { AgentTemplatesService } from "@modules/domain/agent-templates"
import type { TemplateView } from "@modules/domain/agent-templates"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MyAgentTemplatesQuery } from "./my-agent-templates.query"

@QueryHandler(MyAgentTemplatesQuery)
/** Lists the templates of the caller with their versions. */
export class MyAgentTemplatesHandler extends ICQRSHandler<MyAgentTemplatesQuery, ReadonlyArray<TemplateView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: AgentTemplatesService,
    ) {
        super(logger)
    }

    protected override process(query: MyAgentTemplatesQuery): Promise<ReadonlyArray<TemplateView>> {
        const p = query.params.principal.id
        return this.svc.mine(p)
    }
}
