import { Query } from "@nestjs/cqrs"
import type { UnreadView } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TeamChatScope } from "./team-chat.contracts"

/** Counts what the caller has not read. */
export class ChatUnreadQuery extends Query<UnreadView> {
    constructor(readonly params: ExecuteParams<TeamChatScope>) {
        super()
    }
}
