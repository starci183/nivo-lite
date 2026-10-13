import { Module } from "@nestjs/common"
import { BeginZaloAuthorizationHandler } from "./application/begin-zalo-authorization.handler"
import { CompleteZaloAuthorizationHandler } from "./application/complete-zalo-authorization.handler"

@Module({ providers: [BeginZaloAuthorizationHandler, CompleteZaloAuthorizationHandler] })
/** The channels feature: the handlers of its application. */
export class ChannelsApiModule {}
