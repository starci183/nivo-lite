import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CaptureChatTruthCommand } from "../../application/capture-chat-truth.command"
import { CaptureChatTruthInput } from "./dto/capture-chat-truth.input"
import { ChatTruthCaptureType } from "./dto/chat-truth-capture.type"
import { toCaptureChatTruthRequest } from "./team-chat-turns.mapper"

@Resolver()
/** GraphQL door of "Ghi vào Second Brain" on a message of the team chat. */
export class CaptureChatTruthResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Files the message as a truth change (the owner or a manager); the card waits in the room for the owner's Đồng ý. */
    @Mutation(() => ChatTruthCaptureType, { name: "captureChatTruth" })
    async captureChatTruth(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CaptureChatTruthInput,
    ): Promise<ChatTruthCaptureType> {
        const outcome = await this.commandBus.execute(
            new CaptureChatTruthCommand({ request: toCaptureChatTruthRequest(workspaceId, input), principal }),
        )
        return { outcome }
    }
}
