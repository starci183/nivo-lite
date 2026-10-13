import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartWebhookConnectionCommand } from "../../application/start-webhook-connection.command"
import { StartWebhookConnectionInput } from "./dto/start-webhook-connection.input"
import { WebhookViewType } from "./dto/webhook-view.type"
import { toStartWebhookConnectionRequest, toStartWebhookConnectionType } from "./start-webhook-connection.mapper"

@Resolver()
/** GraphQL door of startWebhookConnection. */
export class StartWebhookConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts a webhook connection as pending. */
    @Mutation(() => WebhookViewType, { name: "startWebhookConnection" })
    async startWebhookConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartWebhookConnectionInput,
    ): Promise<WebhookViewType> {
        const result = await this.commandBus.execute(
            new StartWebhookConnectionCommand({
                request: toStartWebhookConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toStartWebhookConnectionType(result)
    }
}
