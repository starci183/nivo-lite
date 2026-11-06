import { Command } from "@nestjs/cqrs"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PinRequest } from "./team-chat.contracts"

/** Pins a message. */
export class PinChatMessageCommand extends Command<TeamChatResult<MessageView>> {
    constructor(readonly params: ExecuteParams<PinRequest>) {
        super()
    }
}
