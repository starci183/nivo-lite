import { Module } from "@nestjs/common"
import { ConnectionGrantsApiModule } from "../../connection-grants.module"
import { ConnectionGrantsController } from "./connection-grants.controller"

@Module({ imports: [ConnectionGrantsApiModule], controllers: [ConnectionGrantsController] })
/** The HTTP transport of the connection-grants feature. */
export class ConnectionGrantsHttpModule {}
