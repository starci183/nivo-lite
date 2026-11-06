import { Command } from "@nestjs/cqrs"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RoomMemberRequest } from "./team-chat.contracts"

/** Adds a member to a group. */
export class AddChatRoomMemberCommand extends Command<TeamChatResult<RoomView>> {
    constructor(readonly params: ExecuteParams<RoomMemberRequest>) {
        super()
    }
}
