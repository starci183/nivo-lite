import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevealWebhookConnectionCommand } from "../../application/reveal-webhook-connection.command"
import { RevealWebhookConnectionInput } from "./dto/reveal-webhook-connection.input"
import { WebhookViewType } from "./dto/webhook-view.type"
import { toRevealWebhookConnectionRequest, toRevealWebhookConnectionType } from "./reveal-webhook-connection.mapper"

@Resolver()
/** GraphQL door of revealWebhookConnection. */
export class RevealWebhookConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Shows the signing secret and the events of a webhook connection again. */
    @Mutation(() => WebhookViewType, { name: "revealWebhookConnection" })
    async revealWebhookConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RevealWebhookConnectionInput,
    ): Promise<WebhookViewType> {
        const result = await this.commandBus.execute(
            new RevealWebhookConnectionCommand({
                request: toRevealWebhookConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toRevealWebhookConnectionType(result)
    }
}
