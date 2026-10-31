import { QueryHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingPage } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DossierFindingsQuery } from "./dossier-findings.query"

@QueryHandler(DossierFindingsQuery)
/** Lists the findings of the workspace, severity first, one page at a time. */
export class DossierFindingsHandler extends ICQRSHandler<DossierFindingsQuery, FindingPage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(query: DossierFindingsQuery): Promise<FindingPage> {
        return this.findings.list(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request,
            query.params.request.locale,
        )
    }
}
