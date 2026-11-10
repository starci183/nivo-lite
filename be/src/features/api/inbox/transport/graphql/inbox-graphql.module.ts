import { Module } from "@nestjs/common"
import { InboxApiModule } from "../../inbox.module"
import { InboundEventsResolver } from "./inbound-events.resolver"
import { InboxLeadsResolver } from "./inbox-leads.resolver"
import { ConfigurableModuleClass } from "./inbox-graphql.module-definition"

@Module({ imports: [InboxApiModule.register({})], providers: [InboundEventsResolver, InboxLeadsResolver] })
/** The GraphQL inbox: the event feed and the lead-centric list, suitable for SWR revalidation or polling. */
export class InboxGraphqlModule extends ConfigurableModuleClass {}
