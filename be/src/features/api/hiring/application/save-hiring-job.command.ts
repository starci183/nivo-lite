import { Command } from "@nestjs/cqrs"
import type { SaveJobOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveHiringJobRequest } from "./save-hiring-job.contracts"

/** Asks for create or update one job post. */
export class SaveHiringJobCommand extends Command<SaveJobOutput> {
    constructor(readonly params: ExecuteParams<SaveHiringJobRequest>) {
        super()
    }
}
