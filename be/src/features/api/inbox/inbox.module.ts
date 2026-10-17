import { Module } from "@nestjs/common"
import { ListInboundEventsHandler } from "./application/list-inbound-events.handler"
import { ConfigurableModuleClass } from "./inbox.module-definition"

@Module({ providers: [ListInboundEventsHandler] })
/** The inbox application queries. */
export class InboxApiModule extends ConfigurableModuleClass {}
