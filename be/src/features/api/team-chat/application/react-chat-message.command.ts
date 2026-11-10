import { Command } from "@nestjs/cqrs"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReactRequest } from "./team-chat.contracts"

/** Adds taps of one emoji to a message. */
export class ReactChatMessageCommand extends Command<TeamChatResult<MessageView>> {
    constructor(readonly params: ExecuteParams<ReactRequest>) {
        super()
    }
}
