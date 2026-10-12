import { Module } from "@nestjs/common"
import { ConnectionsApiModule } from "../../connections.module"
import { ConnectionsController } from "./connections.controller"

@Module({ imports: [ConnectionsApiModule], controllers: [ConnectionsController] })
/** The HTTP transport of the connections feature. */
export class ConnectionsHttpModule {}
