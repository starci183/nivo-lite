import { Module } from "@nestjs/common"
import { WebhookConnectionsApiModule } from "../../webhook-connections.module"
import { WebhookConnectionsController } from "./webhook-connections.controller"

@Module({ imports: [WebhookConnectionsApiModule], controllers: [WebhookConnectionsController] })
/** The HTTP transport of the webhook-connections feature. */
export class WebhookConnectionsHttpModule {}
