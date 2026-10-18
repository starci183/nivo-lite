import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunNowRequest } from "./run-now.contracts"

/** Runs a scheduled n8n template once now. */
export class RunNowCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RunNowRequest>) {
        super()
    }
}
