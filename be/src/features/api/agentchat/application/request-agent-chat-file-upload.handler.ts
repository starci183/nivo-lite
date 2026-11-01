import { CommandHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { ChatFileUpload } from "@modules/domain/chat-files"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestAgentChatFileUploadCommand } from "./request-agent-chat-file-upload.command"

@CommandHandler(RequestAgentChatFileUploadCommand)
/** Dispatches requestAgentChatFileUpload to the membership-proving chat service. */
export class RequestAgentChatFileUploadHandler extends ICQRSHandler<RequestAgentChatFileUploadCommand, ChatFileUpload> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(command: RequestAgentChatFileUploadCommand): Promise<ChatFileUpload> {
        return this.chat.requestFileUpload(command.params.principal.id, command.params.request)
    }
}
