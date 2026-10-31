import { Command } from "@nestjs/cqrs"
import type { DossierImportResult } from "@modules/domain/brain-dossiers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ImportBrainDossiersRequest } from "./import-brain-dossiers.contracts"

/** Replaces the dossiers the workspace tracks with those of an uploaded checklist workbook. */
export class ImportBrainDossiersCommand extends Command<DossierImportResult> {
    constructor(readonly params: ExecuteParams<ImportBrainDossiersRequest>) {
        super()
    }
}
