import { Command } from "@nestjs/cqrs"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PostSetupMessageRequest } from "./post-setup-message.contracts"

/** Asks to store an owner message in the open draft and queue the answer of NIVO. */
export class PostSetupMessageCommand extends Command<SetupMessageRecord> {
    constructor(readonly params: ExecuteParams<PostSetupMessageRequest>) {
        super()
    }
}
