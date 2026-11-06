import { Command } from "@nestjs/cqrs"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetMutedRequest } from "./team-chat.contracts"

/** Mutes or unmutes a room for the caller. */
export class SetChatRoomMutedCommand extends Command<TeamChatResult<ChatRoomView>> {
    constructor(readonly params: ExecuteParams<SetMutedRequest>) {
        super()
    }
}
