import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { ChatUpload, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestChatFileUploadCommand } from "./request-chat-file-upload.command"

@CommandHandler(RequestChatFileUploadCommand)
/** Issues the address a browser uploads one file to. The service proves the caller's seat and the room. */
export class RequestChatFileUploadHandler extends ICQRSHandler<
    RequestChatFileUploadCommand,
    TeamChatResult<ChatUpload>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: RequestChatFileUploadCommand): Promise<TeamChatResult<ChatUpload>> {
        const { principal: p, request: r } = command.params
        return this.chat.requestUpload(r.workspaceId, p.id, r.roomId, r)
    }
}
