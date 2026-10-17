import { Module } from "@nestjs/common"
import { MetaCallbackHandler } from "./application/meta-callback.handler"
import { ConfigurableModuleClass } from "./meta-connections.module-definition"

@Module({ providers: [MetaCallbackHandler] })
/** The Meta OAuth callback handler. */
export class MetaConnectionsApiModule extends ConfigurableModuleClass {}
