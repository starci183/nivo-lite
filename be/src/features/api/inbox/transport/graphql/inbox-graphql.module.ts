import { Module } from "@nestjs/common"
import { InboxApiModule } from "../../inbox.module"
import { InboundEventsResolver } from "./inbound-events.resolver"

@Module({ imports: [InboxApiModule], providers: [InboundEventsResolver] })
/** The GraphQL inbox feed, suitable for SWR revalidation or polling. */
export class InboxGraphqlModule {}
