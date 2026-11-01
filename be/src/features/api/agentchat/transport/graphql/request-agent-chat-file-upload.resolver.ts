import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestAgentChatFileUploadCommand } from "../../application/request-agent-chat-file-upload.command"
import { AgentChatFileUploadType } from "./dto/agent-chat-file-upload.type"
import { RequestAgentChatFileUploadInput } from "./dto/request-agent-chat-file-upload.input"
import { toAgentChatFileUploadType, toRequestAgentChatFileUploadRequest } from "./request-agent-chat-file-upload.mapper"

@Resolver()
/** The GraphQL door for requestAgentChatFileUpload. */
export class RequestAgentChatFileUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs requestAgentChatFileUpload under the verified caller. */
    @Mutation(() => AgentChatFileUploadType, { name: "requestAgentChatFileUpload" })
    async requestAgentChatFileUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestAgentChatFileUploadInput,
    ): Promise<AgentChatFileUploadType> {
        const result = await this.commandBus.execute(
            new RequestAgentChatFileUploadCommand({
                request: toRequestAgentChatFileUploadRequest(workspaceId, input),
                principal,
            }),
        )
        return toAgentChatFileUploadType(result)
    }
}
