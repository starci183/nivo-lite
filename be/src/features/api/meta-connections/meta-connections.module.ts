import { Module } from "@nestjs/common"
import { MetaCallbackHandler } from "./application/meta-callback.handler"

@Module({ providers: [MetaCallbackHandler] })
/** The Meta OAuth callback handler. */
export class MetaConnectionsApiModule {}
