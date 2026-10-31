import { Command } from "@nestjs/cqrs"
import type { FindingRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResolveDossierFindingRequest } from "./resolve-dossier-finding.contracts"

/** Marks a finding as done outside the app, with what was done. */
export class ResolveDossierFindingCommand extends Command<FindingRecord> {
    constructor(readonly params: ExecuteParams<ResolveDossierFindingRequest>) {
        super()
    }
}
