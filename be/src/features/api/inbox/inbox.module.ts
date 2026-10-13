import { Module } from "@nestjs/common"
import { ListInboundEventsHandler } from "./application/list-inbound-events.handler"

@Module({ providers: [ListInboundEventsHandler] })
/** The inbox application queries. */
export class InboxApiModule {}
