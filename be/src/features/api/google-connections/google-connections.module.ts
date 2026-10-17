import { Module } from "@nestjs/common"
import { GoogleCallbackHandler } from "./application/google-callback.handler"
import { ConfigurableModuleClass } from "./google-connections.module-definition"

@Module({ providers: [GoogleCallbackHandler] })
/** The google-connections feature: the handler of its OAuth callback. */
export class GoogleConnectionsApiModule extends ConfigurableModuleClass {}
