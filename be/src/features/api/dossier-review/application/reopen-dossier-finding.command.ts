import { Command } from "@nestjs/cqrs"
import type { FindingRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReopenDossierFindingRequest } from "./reopen-dossier-finding.contracts"

/** Reopens a dismissed or resolved finding. */
export class ReopenDossierFindingCommand extends Command<FindingRecord> {
    constructor(readonly params: ExecuteParams<ReopenDossierFindingRequest>) {
        super()
    }
}
