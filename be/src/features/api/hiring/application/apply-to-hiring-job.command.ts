import { Command } from "@nestjs/cqrs"
import type { ApplyOutput, ApplyParams } from "@modules/domain/hiring"
import type { PublicExecuteParams } from "@modules/platform/cqrs"

/** Asks for apply for a job. */
export class ApplyToHiringJobCommand extends Command<ApplyOutput> {
    constructor(readonly params: PublicExecuteParams<ApplyParams>) {
        super()
    }
}
