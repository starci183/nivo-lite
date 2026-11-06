import { Command } from "@nestjs/cqrs"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateRoomRequest } from "./team-chat.contracts"

/** Opens a direct room or a group. */
export class CreateChatRoomCommand extends Command<TeamChatResult<ChatRoomView>> {
    constructor(readonly params: ExecuteParams<CreateRoomRequest>) {
        super()
    }
}
