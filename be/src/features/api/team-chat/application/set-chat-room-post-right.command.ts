import { Command } from "@nestjs/cqrs"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetPostRightRequest } from "./team-chat.contracts"

/** Grants or revokes an agent's right to post in a group. */
export class SetChatRoomPostRightCommand extends Command<TeamChatResult<ChatRoomView>> {
    constructor(readonly params: ExecuteParams<SetPostRightRequest>) {
        super()
    }
}
