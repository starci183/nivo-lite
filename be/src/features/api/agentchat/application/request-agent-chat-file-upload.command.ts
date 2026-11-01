import { Command } from "@nestjs/cqrs"
import type { RequestChatFileUpload } from "@modules/domain/agent-chat"
import type { ChatFileUpload } from "@modules/domain/chat-files"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests an upload address for a file of a chat message in the caller's selected workspace. */
export class RequestAgentChatFileUploadCommand extends Command<ChatFileUpload> {
    constructor(readonly params: ExecuteParams<RequestChatFileUpload>) {
        super()
    }
}
