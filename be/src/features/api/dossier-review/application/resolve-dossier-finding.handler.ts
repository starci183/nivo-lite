import { CommandHandler } from "@nestjs/cqrs"
import { DossierFindingsService } from "@modules/domain/dossier-review"
import type { FindingRecord } from "@modules/domain/dossier-review"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResolveDossierFindingCommand } from "./resolve-dossier-finding.command"

@CommandHandler(ResolveDossierFindingCommand)
/** Marks a finding as done outside the app, with what was done. */
export class ResolveDossierFindingHandler extends ICQRSHandler<ResolveDossierFindingCommand, FindingRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly findings: DossierFindingsService,
    ) {
        super(logger)
    }

    protected override process(command: ResolveDossierFindingCommand): Promise<FindingRecord> {
        return this.findings.resolve(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
            command.params.request.locale,
        )
    }
}
