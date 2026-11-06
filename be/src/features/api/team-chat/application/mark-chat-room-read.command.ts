import { Command } from "@nestjs/cqrs"
import type { RoomUnread, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MarkReadRequest } from "./team-chat.contracts"

/** Moves the read position. */
export class MarkChatRoomReadCommand extends Command<TeamChatResult<RoomUnread>> {
    constructor(readonly params: ExecuteParams<MarkReadRequest>) {
        super()
    }
}
