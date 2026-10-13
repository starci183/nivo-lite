import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { FinishWebhookConnectionCommand } from "../../application/finish-webhook-connection.command"
import { FinishWebhookConnectionInput } from "./dto/finish-webhook-connection.input"
import { toFinishWebhookConnectionRequest } from "./finish-webhook-connection.mapper"

@Resolver()
/** GraphQL door of finishWebhookConnection. */
export class FinishWebhookConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a webhook connection live. */
    @Mutation(() => Boolean, { name: "finishWebhookConnection" })
    async finishWebhookConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: FinishWebhookConnectionInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new FinishWebhookConnectionCommand({
                request: toFinishWebhookConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
