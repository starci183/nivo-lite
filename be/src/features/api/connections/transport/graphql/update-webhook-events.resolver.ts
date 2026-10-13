import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateWebhookEventsCommand } from "../../application/update-webhook-events.command"
import { UpdateWebhookEventsInput } from "./dto/update-webhook-events.input"
import { WebhookEventsType } from "./dto/webhook-events.type"
import { toUpdateWebhookEventsRequest, toUpdateWebhookEventsType } from "./update-webhook-events.mapper"

@Resolver()
/** GraphQL door of updateWebhookEvents. */
export class UpdateWebhookEventsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes which events a webhook connection receives. */
    @Mutation(() => WebhookEventsType, { name: "updateWebhookEvents" })
    async updateWebhookEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateWebhookEventsInput,
    ): Promise<WebhookEventsType> {
        const result = await this.commandBus.execute(
            new UpdateWebhookEventsCommand({ request: toUpdateWebhookEventsRequest(workspaceId, input), principal }),
        )
        return toUpdateWebhookEventsType(result)
    }
}
