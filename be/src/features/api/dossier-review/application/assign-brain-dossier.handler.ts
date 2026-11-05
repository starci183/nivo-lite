import { CommandHandler } from "@nestjs/cqrs"
import { BrainDossiersService } from "@modules/domain/brain-dossiers"
import type { DossierRecord } from "@modules/domain/brain-dossiers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AssignBrainDossierCommand } from "./assign-brain-dossier.command"

@CommandHandler(AssignBrainDossierCommand)
/** Gives a dossier to a member of the workspace with an optional due date, or takes both back. */
export class AssignBrainDossierHandler extends ICQRSHandler<AssignBrainDossierCommand, DossierRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly dossiers: BrainDossiersService,
    ) {
        super(logger)
    }

    protected override process(command: AssignBrainDossierCommand): Promise<DossierRecord> {
        return this.dossiers.assign(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
