import { Command } from "@nestjs/cqrs"
import type { DeleteCandidateOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteHiringCandidateRequest } from "./delete-hiring-candidate.contracts"

/** Asks for delete a candidate with every trace. */
export class DeleteHiringCandidateCommand extends Command<DeleteCandidateOutput> {
    constructor(readonly params: ExecuteParams<DeleteHiringCandidateRequest>) {
        super()
    }
}
