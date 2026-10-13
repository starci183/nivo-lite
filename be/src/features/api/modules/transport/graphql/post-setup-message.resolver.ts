import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { PostSetupMessageCommand } from "../../application/post-setup-message.command"
import { SetupMessageType } from "./dto/setup-message.type"
import { PostSetupMessageInput } from "./dto/post-setup-message.input"
import { toPostSetupMessageRequest, toSetupMessageType } from "./modules.mapper"

@Resolver()
/** GraphQL door that posts a message in the setup chat. */
export class PostSetupMessageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Stores one owner message in the open draft and queues the answer of NIVO (read it with `setupState`). */
    @Mutation(() => SetupMessageType, { name: "postSetupMessage" })
    async postSetupMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: PostSetupMessageInput,
    ): Promise<SetupMessageType> {
        const result = await this.commandBus.execute(
            new PostSetupMessageCommand({ request: toPostSetupMessageRequest(workspaceId, input, locale), principal }),
        )
        return toSetupMessageType(result)
    }
}
