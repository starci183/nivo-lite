import { CommandHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignDossierFindingCommand } from "./assign-dossier-finding.command"

@CommandHandler(AssignDossierFindingCommand)
/** Gives a finding to a member of the workspace, with an optional due date. */
export class AssignDossierFindingHandler extends ICQRSHandler<AssignDossierFindingCommand, FindingRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(command: AssignDossierFindingCommand): Promise<FindingRecord> {
        return this.findings.assign(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
            command.params.request.locale,
        )
    }
}
