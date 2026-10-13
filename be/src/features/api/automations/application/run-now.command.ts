import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunNowRequest, RunNowResult } from "./run-now.contracts"

/** Runs a scheduled n8n template once now. */
export class RunNowCommand extends Command<RunNowResult> {
    constructor(readonly params: ExecuteParams<RunNowRequest>) {
        super()
    }
}
