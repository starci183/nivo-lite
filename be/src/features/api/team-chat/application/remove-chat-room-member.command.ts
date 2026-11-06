import { Command } from "@nestjs/cqrs"
import type { RoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RoomMemberRequest } from "./team-chat.contracts"

/** Removes a member from a group. */
export class RemoveChatRoomMemberCommand extends Command<TeamChatResult<RoomView | null>> {
    constructor(readonly params: ExecuteParams<RoomMemberRequest>) {
        super()
    }
}
