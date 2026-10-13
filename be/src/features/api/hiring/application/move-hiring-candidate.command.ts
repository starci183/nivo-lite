import { Command } from "@nestjs/cqrs"
import type { MoveCandidateOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MoveHiringCandidateRequest } from "./move-hiring-candidate.contracts"

/** Asks for move a candidate to another stage. */
export class MoveHiringCandidateCommand extends Command<MoveCandidateOutput> {
    constructor(readonly params: ExecuteParams<MoveHiringCandidateRequest>) {
        super()
    }
}
