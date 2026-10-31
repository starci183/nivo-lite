import { CommandHandler } from "@nestjs/cqrs"
import { BrainDossiersService } from "@modules/domain/brain-dossiers"
import type { DossierImportResult } from "@modules/domain/brain-dossiers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ImportBrainDossiersCommand } from "./import-brain-dossiers.command"

@CommandHandler(ImportBrainDossiersCommand)
/** Replaces the dossiers the workspace tracks with those of an uploaded checklist workbook. */
export class ImportBrainDossiersHandler extends ICQRSHandler<ImportBrainDossiersCommand, DossierImportResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly dossiers: BrainDossiersService,
    ) {
        super(logger)
    }

    protected override process(command: ImportBrainDossiersCommand): Promise<DossierImportResult> {
        return this.dossiers.importChecklist(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
