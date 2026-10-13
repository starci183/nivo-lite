import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MarkNoShowRequest, MarkNoShowResult } from "./mark-no-show.contracts"

/** Records that the customer did not come. */
export class MarkNoShowCommand extends Command<MarkNoShowResult> {
    constructor(readonly params: ExecuteParams<MarkNoShowRequest>) {
        super()
    }
}
