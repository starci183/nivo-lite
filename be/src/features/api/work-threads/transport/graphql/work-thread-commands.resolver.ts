import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { CreateWorkThreadCommand } from "../../application/create-work-thread.command"
import { DecideThreadApprovalCommand } from "../../application/decide-thread-approval.command"
import { PostThreadMessageCommand } from "../../application/post-thread-message.command"
import { CreateWorkThreadInput } from "./dto/create-work-thread.input"
import { DecideThreadApprovalInput } from "./dto/decide-thread-approval.input"
import { PostThreadMessageInput } from "./dto/post-thread-message.input"
import { ThreadMessageType } from "./dto/thread-message.type"
import { WorkThreadType } from "./dto/work-thread.type"
import {
    toCreateWorkThreadRequest,
    toDecideThreadApprovalRequest,
    toPostThreadMessageRequest,
    toThreadMessageType,
    toWorkThreadType,
} from "./work-threads.mapper"

@Resolver()
/** GraphQL doors that write work threads: opening one, writing in it and deciding an approval card. */
export class WorkThreadCommandsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Opens a thread for a member of the workspace. */
    @Mutation(() => WorkThreadType, { name: "createWorkThread" })
    async createWorkThread(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateWorkThreadInput,
    ): Promise<WorkThreadType> {
        const result = await this.commandBus.execute(
            new CreateWorkThreadCommand({ request: toCreateWorkThreadRequest(workspaceId, input), principal }),
        )
        return toWorkThreadType(result)
    }

    /** Writes a message into a thread with the tags the member chose. */
    @Mutation(() => ThreadMessageType, { name: "postThreadMessage" })
    async postThreadMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PostThreadMessageInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<ThreadMessageType> {
        const result = await this.commandBus.execute(
            new PostThreadMessageCommand({
                request: toPostThreadMessageRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toThreadMessageType(result)
    }

    /** Approves or rejects the card of a message. */
    @Mutation(() => ThreadMessageType, { name: "decideThreadApproval" })
    async decideThreadApproval(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideThreadApprovalInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<ThreadMessageType> {
        const result = await this.commandBus.execute(
            new DecideThreadApprovalCommand({
                request: toDecideThreadApprovalRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toThreadMessageType(result)
    }
}
