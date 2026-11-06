import { Command } from "@nestjs/cqrs"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SendMessageRequest } from "./team-chat.contracts"

/** Writes a text message. */
export class SendChatMessageCommand extends Command<TeamChatResult<MessageView>> {
    constructor(readonly params: ExecuteParams<SendMessageRequest>) {
        super()
    }
}
