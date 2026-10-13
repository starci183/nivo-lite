import { Command } from "@nestjs/cqrs"
import type { SetJobStatusOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetHiringJobStatusRequest } from "./set-hiring-job-status.contracts"

/** Asks for open, pause or close a job. */
export class SetHiringJobStatusCommand extends Command<SetJobStatusOutput> {
    constructor(readonly params: ExecuteParams<SetHiringJobStatusRequest>) {
        super()
    }
}
