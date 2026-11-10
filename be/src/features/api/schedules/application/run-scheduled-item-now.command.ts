import { Command } from "@nestjs/cqrs"
import type { RunNowAnswer } from "@modules/domain/agent-doors"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RunScheduledItemNowRequest } from "./schedules.contracts"

/** Runs one scheduled item now: its own job moves to now, never a second one. */
export class RunScheduledItemNowCommand extends Command<RunNowAnswer> {
    constructor(readonly params: ExecuteParams<RunScheduledItemNowRequest>) {
        super()
    }
}
