import { Module } from "@nestjs/common"
import { SetAgentConnectionsHandler } from "./application/set-agent-connections.handler"
import { SetConnectionAgentsHandler } from "./application/set-connection-agents.handler"
import { SetGrantHandler } from "./application/set-grant.handler"

@Module({ providers: [SetGrantHandler, SetConnectionAgentsHandler, SetAgentConnectionsHandler] })
/** The connection-grants feature: the handlers of its application. */
export class ConnectionGrantsApiModule {}
