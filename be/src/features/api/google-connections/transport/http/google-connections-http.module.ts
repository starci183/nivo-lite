import { Module } from "@nestjs/common"
import { GoogleConnectionsApiModule } from "../../google-connections.module"
import { GoogleCallbackController } from "./google-callback.controller"
import { ConfigurableModuleClass } from "./google-connections-http.module-definition"

@Module({ imports: [GoogleConnectionsApiModule.register({})], controllers: [GoogleCallbackController] })
/** The HTTP transport of the google-connections feature: the callback Google redirects the browser to. */
export class GoogleConnectionsHttpModule extends ConfigurableModuleClass {}
