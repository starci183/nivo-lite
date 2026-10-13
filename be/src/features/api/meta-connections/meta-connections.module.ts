import { Module } from "@nestjs/common"
import { MetaCallbackHandler } from "./application/meta-callback.handler"
import { MetaChallengeHandler } from "./application/meta-challenge.handler"
import { AcceptMetaDeliveryHandler } from "./application/accept-meta-delivery.handler"

@Module({ providers: [AcceptMetaDeliveryHandler, MetaCallbackHandler, MetaChallengeHandler] })
/** The meta-connections feature: the handlers of the OAuth callback and the webhook doors. */
export class MetaConnectionsApiModule {}
