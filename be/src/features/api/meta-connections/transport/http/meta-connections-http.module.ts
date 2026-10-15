import { Module } from "@nestjs/common"
import { MetaConnectionsApiModule } from "../../meta-connections.module"
import { MetaCallbackController } from "./meta-callback.controller"

@Module({ imports: [MetaConnectionsApiModule], controllers: [MetaCallbackController] })
/** The HTTP transport of the Meta OAuth callback. */
export class MetaConnectionsHttpModule {}
