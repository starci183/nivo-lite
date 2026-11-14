import { QueryHandler } from "@nestjs/cqrs"
import { CrmConnectService, type CrmTemplateView } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LoadCrmTemplatesQuery } from "./load-crm-templates.query"

@QueryHandler(LoadCrmTemplatesQuery)
/** Reads the CRM templates through the CrmConnectService. */
export class LoadCrmTemplatesHandler extends ICQRSHandler<LoadCrmTemplatesQuery, ReadonlyArray<CrmTemplateView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly crm: CrmConnectService,
    ) {
        super(logger)
    }

    protected override process(query: LoadCrmTemplatesQuery): Promise<ReadonlyArray<CrmTemplateView>> {
        return this.crm.templates(query.params.request.workspaceId)
    }
}
