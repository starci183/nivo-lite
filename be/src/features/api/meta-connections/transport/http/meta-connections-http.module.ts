import { Module } from "@nestjs/common"
import { MetaConnectionsApiModule } from "../../meta-connections.module"
import { MetaCallbackController } from "./meta-callback.controller"
import { MetaEventsController } from "./meta-events.controller"
import { MetaConnectionsController } from "./meta-connections.controller"

@Module({
    imports: [MetaConnectionsApiModule],
    controllers: [MetaConnectionsController, MetaCallbackController, MetaEventsController],
})
/** The HTTP transport of the meta-connections feature. */
export class MetaConnectionsHttpModule {}
