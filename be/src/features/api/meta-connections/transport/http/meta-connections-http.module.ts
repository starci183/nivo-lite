import { Module } from "@nestjs/common"
import { MetaConnectionsApiModule } from "../../meta-connections.module"
import { MetaCallbackController } from "./meta-callback.controller"
import { MetaEventsController } from "./meta-events.controller"

@Module({ imports: [MetaConnectionsApiModule], controllers: [MetaCallbackController, MetaEventsController] })
/** The HTTP transport of the meta-connections feature: the callback and the webhook Meta calls. */
export class MetaConnectionsHttpModule {}
