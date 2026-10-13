import { Module } from "@nestjs/common"
import { StartWebhookHandler } from "./application/start-webhook.handler"
import { RevealWebhookHandler } from "./application/reveal-webhook.handler"
import { UpdateWebhookEventsHandler } from "./application/update-webhook-events.handler"
import { TestWebhookHandler } from "./application/test-webhook.handler"
import { FinishWebhookHandler } from "./application/finish-webhook.handler"

@Module({
    providers: [
        StartWebhookHandler,
        RevealWebhookHandler,
        UpdateWebhookEventsHandler,
        TestWebhookHandler,
        FinishWebhookHandler,
    ],
})
/** The webhook-connections feature: the handlers of its application. */
export class WebhookConnectionsApiModule {}
