import { Command } from "@nestjs/cqrs"
import type { ChatUpload, TeamChatResult } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestUploadRequest } from "./team-chat.contracts"

/** Issues the address a browser uploads one file to. */
export class RequestChatFileUploadCommand extends Command<TeamChatResult<ChatUpload>> {
    constructor(readonly params: ExecuteParams<RequestUploadRequest>) {
        super()
    }
}
