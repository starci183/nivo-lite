import { Command } from "@nestjs/cqrs"
import type { ChatRoomView, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetPurposeRequest } from "./team-chat.contracts"

/** Gives a group its purpose. */
export class SetChatRoomPurposeCommand extends Command<TeamChatResult<ChatRoomView>> {
    constructor(readonly params: ExecuteParams<SetPurposeRequest>) {
        super()
    }
}
