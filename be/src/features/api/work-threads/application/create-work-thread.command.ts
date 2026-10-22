import { Command } from "@nestjs/cqrs"
import type { WorkThread } from "@modules/domain/work-threads"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateWorkThreadRequest } from "./create-work-thread.contracts"

/** Asks to open a work thread. */
export class CreateWorkThreadCommand extends Command<WorkThread> {
    constructor(readonly params: ExecuteParams<CreateWorkThreadRequest>) {
        super()
    }
}
