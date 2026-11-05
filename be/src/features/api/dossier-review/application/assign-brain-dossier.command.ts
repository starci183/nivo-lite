import { Command } from "@nestjs/cqrs"
import type { DossierRecord } from "@modules/domain/brain-dossiers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignBrainDossierRequest } from "./assign-brain-dossier.contracts"

/** Gives a dossier to a member of the workspace with an optional due date, or takes both back. */
export class AssignBrainDossierCommand extends Command<DossierRecord> {
    constructor(readonly params: ExecuteParams<AssignBrainDossierRequest>) {
        super()
    }
}
