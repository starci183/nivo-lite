import { Command } from "@nestjs/cqrs"
import type { FindingRecord } from "@modules/domain/dossier-review"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignDossierFindingRequest } from "./assign-dossier-finding.contracts"

/** Gives a finding to a member of the workspace, with an optional due date. */
export class AssignDossierFindingCommand extends Command<FindingRecord> {
    constructor(readonly params: ExecuteParams<AssignDossierFindingRequest>) {
        super()
    }
}
