import { Module } from "@nestjs/common"
import { CheckFirstEventHandler } from "./application/check-first-event.handler"
import { WantConnectorHandler } from "./application/want-connector.handler"

@Module({ providers: [CheckFirstEventHandler, WantConnectorHandler] })
/** The connections feature: the handlers of its application. */
export class ConnectionsApiModule {}
