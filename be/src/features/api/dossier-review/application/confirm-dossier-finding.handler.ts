import { CommandHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConfirmDossierFindingCommand } from "./confirm-dossier-finding.command"

@CommandHandler(ConfirmDossierFindingCommand)
/** Confirms an open finding, with an optional note. */
export class ConfirmDossierFindingHandler extends ICQRSHandler<ConfirmDossierFindingCommand, FindingRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(command: ConfirmDossierFindingCommand): Promise<FindingRecord> {
        return this.findings.confirm(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
            command.params.request.locale,
        )
    }
}
