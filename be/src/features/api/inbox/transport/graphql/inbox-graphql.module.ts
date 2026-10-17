import { Module } from "@nestjs/common"
import { InboxApiModule } from "../../inbox.module"
import { InboundEventsResolver } from "./inbound-events.resolver"
import { ConfigurableModuleClass } from "./inbox-graphql.module-definition"

@Module({ imports: [InboxApiModule.register({})], providers: [InboundEventsResolver] })
/** The GraphQL inbox feed, suitable for SWR revalidation or polling. */
export class InboxGraphqlModule extends ConfigurableModuleClass {}
