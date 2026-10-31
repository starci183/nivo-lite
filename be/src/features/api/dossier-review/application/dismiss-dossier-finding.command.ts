import { Command } from "@nestjs/cqrs"
import type { FindingRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DismissDossierFindingRequest } from "./dismiss-dossier-finding.contracts"

/** Dismisses a finding with the reason the owner gives. */
export class DismissDossierFindingCommand extends Command<FindingRecord> {
    constructor(readonly params: ExecuteParams<DismissDossierFindingRequest>) {
        super()
    }
}
