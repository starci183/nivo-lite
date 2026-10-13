import { Module } from "@nestjs/common"
import { ConnectionLifecycleApiModule } from "../../connection-lifecycle.module"
import { ConnectionLifecycleController } from "./connection-lifecycle.controller"

@Module({ imports: [ConnectionLifecycleApiModule], controllers: [ConnectionLifecycleController] })
/** The HTTP transport of the connection-lifecycle feature. */
export class ConnectionLifecycleHttpModule {}
