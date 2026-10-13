import { Module } from "@nestjs/common"
import { MetaConnectionsApiModule } from "../../meta-connections.module"
import { MetaCallbackController } from "./meta-callback.controller"
import { MetaConnectionsController } from "./meta-connections.controller"

@Module({ imports: [MetaConnectionsApiModule], controllers: [MetaConnectionsController, MetaCallbackController] })
/** The HTTP transport of the meta-connections feature. */
export class MetaConnectionsHttpModule {}
