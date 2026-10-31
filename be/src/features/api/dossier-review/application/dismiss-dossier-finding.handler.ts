import { CommandHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DismissDossierFindingCommand } from "./dismiss-dossier-finding.command"

@CommandHandler(DismissDossierFindingCommand)
/** Dismisses a finding with the reason the owner gives. */
export class DismissDossierFindingHandler extends ICQRSHandler<DismissDossierFindingCommand, FindingRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(command: DismissDossierFindingCommand): Promise<FindingRecord> {
        return this.findings.dismiss(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
            command.params.request.locale,
        )
    }
}
