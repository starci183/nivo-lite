import { Module } from "@nestjs/common"
import { MetaConnectionsApiModule } from "../../meta-connections.module"
import { MetaCallbackController } from "./meta-callback.controller"
import { ConfigurableModuleClass } from "./meta-connections-http.module-definition"

@Module({ imports: [MetaConnectionsApiModule.register({})], controllers: [MetaCallbackController] })
/** The HTTP transport of the Meta OAuth callback. */
export class MetaConnectionsHttpModule extends ConfigurableModuleClass {}
