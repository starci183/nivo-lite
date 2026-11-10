import { Module } from "@nestjs/common"
import { AssignInboxLeadHandler } from "./application/assign-inbox-lead.handler"
import { GetInboxLeadHandler } from "./application/get-inbox-lead.handler"
import { GetWebsiteSiteHandler } from "./application/get-website-site.handler"
import { ListInboundEventsHandler } from "./application/list-inbound-events.handler"
import { ListInboxLeadsHandler } from "./application/list-inbox-leads.handler"
import { SaveWebsiteSiteHandler } from "./application/save-website-site.handler"
import { SubmitWebsiteLeadHandler } from "./application/submit-website-lead.handler"
import { ConfigurableModuleClass } from "./inbox.module-definition"

@Module({
    providers: [
        ListInboundEventsHandler,
        ListInboxLeadsHandler,
        GetInboxLeadHandler,
        AssignInboxLeadHandler,
        GetWebsiteSiteHandler,
        SaveWebsiteSiteHandler,
        SubmitWebsiteLeadHandler,
    ],
})
/** The inbox application queries and commands: the event feed, the customers, the hand-over and the website intake. */
export class InboxApiModule extends ConfigurableModuleClass {}
