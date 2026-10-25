import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatMuteRequest } from "./chat-markers.contracts"

/** Sets the caller's mute preference for one proven chat. */
export class SetChatMutedCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChatMuteRequest>) {
        super()
    }
}
