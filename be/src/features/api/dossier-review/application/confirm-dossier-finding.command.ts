import { Command } from "@nestjs/cqrs"
import type { FindingRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConfirmDossierFindingRequest } from "./confirm-dossier-finding.contracts"

/** Confirms an open finding, with an optional note. */
export class ConfirmDossierFindingCommand extends Command<FindingRecord> {
    constructor(readonly params: ExecuteParams<ConfirmDossierFindingRequest>) {
        super()
    }
}
