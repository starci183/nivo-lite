import { Command } from "@nestjs/cqrs"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ForwardRequest } from "./team-chat.contracts"

/** Forwards a message into another room. */
export class ForwardChatMessageCommand extends Command<TeamChatResult<MessageView>> {
    constructor(readonly params: ExecuteParams<ForwardRequest>) {
        super()
    }
}
