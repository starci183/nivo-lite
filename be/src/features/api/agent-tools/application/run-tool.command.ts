import { Command } from "@nestjs/cqrs"
import type { JsonResult } from "@modules/domain/agent-tools"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RunToolRequest } from "./run-tool.contracts"

/** Asks to run one tool for the job the token names. */
export class RunToolCommand extends Command<JsonResult> {
    constructor(readonly params: PublicExecuteParams<RunToolRequest>) {
        super()
    }
}
