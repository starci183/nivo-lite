import { Module } from "@nestjs/common"
import { DisconnectConnectionHandler } from "./application/disconnect-connection.handler"
import { DeleteConnectionHandler } from "./application/delete-connection.handler"

@Module({
    providers: [DisconnectConnectionHandler, DeleteConnectionHandler],
})
/** The connection-lifecycle feature: the handlers of its application. */
export class ConnectionLifecycleApiModule {}
