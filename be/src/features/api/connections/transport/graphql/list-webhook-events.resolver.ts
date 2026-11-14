import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ListWebhookEventsQuery } from "../../application/list-webhook-events.query"
import { WebhookEventOptionType } from "./dto/webhook-event-option.type"
import { toListWebhookEventsRequest, toListWebhookEventsType } from "./list-webhook-events.mapper"

@Resolver()
/** GraphQL door of webhookEvents. */
export class ListWebhookEventsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the outgoing events a webhook receiver may pick: the installed plugins' and the engine's own. */
    @Query(() => [WebhookEventOptionType], { name: "webhookEvents" })
    async webhookEvents(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<WebhookEventOptionType>> {
        const result = await this.queryBus.execute(
            new ListWebhookEventsQuery({ request: toListWebhookEventsRequest(workspaceId), principal }),
        )
        return toListWebhookEventsType(result)
    }
}
