import { Command } from "@nestjs/cqrs"
import type { RescreenOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RescreenHiringCandidateRequest } from "./rescreen-hiring-candidate.contracts"

/** Asks for screen a candidate again. */
export class RescreenHiringCandidateCommand extends Command<RescreenOutput> {
    constructor(readonly params: ExecuteParams<RescreenHiringCandidateRequest>) {
        super()
    }
}
