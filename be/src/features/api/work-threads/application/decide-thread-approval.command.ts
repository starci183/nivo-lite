import { Command } from "@nestjs/cqrs"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideThreadApprovalRequest } from "./decide-thread-approval.contracts"

/** Asks to approve or reject the card of a thread message. */
export class DecideThreadApprovalCommand extends Command<ThreadMessage> {
    constructor(readonly params: ExecuteParams<DecideThreadApprovalRequest>) {
        super()
    }
}
