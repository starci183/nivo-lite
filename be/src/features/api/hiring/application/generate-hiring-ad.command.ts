import { Command } from "@nestjs/cqrs"
import type { GenerateAdOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GenerateHiringAdRequest } from "./generate-hiring-ad.contracts"

/** Asks for draft the copy-ready ads of a job. */
export class GenerateHiringAdCommand extends Command<GenerateAdOutput> {
    constructor(readonly params: ExecuteParams<GenerateHiringAdRequest>) {
        super()
    }
}
