import { Command } from "@nestjs/cqrs"
import type { ApplyOutput } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ApplyToHiringJobRequest } from "./apply-to-hiring-job.contracts"

/** Asks for apply for a job. */
export class ApplyToHiringJobCommand extends Command<ApplyOutput> {
    constructor(readonly params: PublicExecuteParams<ApplyToHiringJobRequest>) {
        super()
    }
}
