import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TestWebhookConnectionCommand } from "../../application/test-webhook-connection.command"
import { TestWebhookConnectionInput } from "./dto/test-webhook-connection.input"
import { WebhookTestResultType } from "./dto/webhook-test-result.type"
import { toTestWebhookConnectionRequest, toTestWebhookConnectionType } from "./test-webhook-connection.mapper"

@Resolver()
/** GraphQL door of testWebhookConnection. */
export class TestWebhookConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends a signed sample event to a webhook connection. */
    @Mutation(() => WebhookTestResultType, { name: "testWebhookConnection" })
    async testWebhookConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: TestWebhookConnectionInput,
    ): Promise<WebhookTestResultType> {
        const result = await this.commandBus.execute(
            new TestWebhookConnectionCommand({
                request: toTestWebhookConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toTestWebhookConnectionType(result)
    }
}
