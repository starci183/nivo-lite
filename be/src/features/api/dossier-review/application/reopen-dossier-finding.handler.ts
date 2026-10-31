import { CommandHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReopenDossierFindingCommand } from "./reopen-dossier-finding.command"

@CommandHandler(ReopenDossierFindingCommand)
/** Reopens a dismissed or resolved finding. */
export class ReopenDossierFindingHandler extends ICQRSHandler<ReopenDossierFindingCommand, FindingRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(command: ReopenDossierFindingCommand): Promise<FindingRecord> {
        return this.findings.reopen(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
            command.params.request.locale,
        )
    }
}
