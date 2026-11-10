import { Injectable, Optional } from "@nestjs/common"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectWebsiteContactRoutes } from "./inbox-leads.decorators"
import type { WebsiteContactRoutes } from "./inbox-leads.decorators"
import { InboxLeadsLogEvent } from "./inbox-leads.log-events"
import {
    firstContactOf,
    WEBSITE_DEFAULT_MODULE,
    WEBSITE_LEAD_CHANNEL,
    WEBSITE_LEAD_TAG_SOURCE,
    websiteLeadEventKeyOf,
    websiteLeadPayloadOf,
    websiteLeadWhoOf,
} from "./website-lead-wake.policy"
import type { WebsiteLeadFacts } from "./website-lead-wake.policy"

/** The language of the line a wake carries: the shop's owners read their inbox in Vietnamese. */
const WAKE_LOCALE = "vi"

@Injectable()
/**
 * Wakes the agent of a website when a form is accepted. It goes through the one tag door the bank feed uses (`AgentTagService`), so the wake,
 * its run and the agent's tag trigger are the door's: the graph sees a system event of source `website_lead` about the customer, with the
 * facts of the form as plain data and the first-contact route that is real for this workspace. The receiving agent is the one the owner
 * picked, else the oldest active Sales agent. Nothing here sends a message: the customer has no chat yet, and no route is ever invented.
 */
export class WebsiteLeadWakeService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly directory: AgentDirectoryService,
        private readonly tags: AgentTagService,
        @Optional() @InjectWebsiteContactRoutes() private readonly routes: WebsiteContactRoutes | null = null,
    ) {}

    /** The agent that receives a website's customers: the one the owner picked, else the oldest active Sales agent, else none. */
    async targetOf(workspaceId: string, siteAgentId: string | null): Promise<string | null> {
        if (siteAgentId !== null) return siteAgentId
        return (await this.directory.firstActiveIdOfModule(workspaceId, WEBSITE_DEFAULT_MODULE)) ?? null
    }

    /** Tags the agent with the accepted form; answers whether a wake was written. A repeat of the same form writes none. */
    async wake(workspaceId: string, agentId: string | null, facts: WebsiteLeadFacts): Promise<boolean> {
        if (agentId === null) {
            this.logger.warn(InboxLeadsLogEvent.WebsiteLeadNoAgent, { leadId: facts.leadId })
            return false
        }
        const routes = (await this.routes?.routesOf(workspaceId)) ?? []
        const first = firstContactOf(facts, routes)
        const result = await this.tags.tagAgent({
            source: WEBSITE_LEAD_TAG_SOURCE,
            workspaceId,
            toAgentId: agentId,
            text: this.catalog.get(
                "inboxLeads.websiteLeadTag",
                { who: websiteLeadWhoOf(facts), request: facts.request ?? "" },
                WAKE_LOCALE,
            ),
            subject: `lead:${facts.leadId}`,
            channel: WEBSITE_LEAD_CHANNEL,
            leadId: facts.leadId,
            locale: WAKE_LOCALE,
            context: websiteLeadPayloadOf(facts, first),
            eventKey: websiteLeadEventKeyOf(facts.inboundEventId),
        })
        if (!result.tagged) {
            this.logger.info(InboxLeadsLogEvent.WebsiteLeadNotWoken, { leadId: facts.leadId, reason: result.reason })
            return false
        }
        this.logger.info(InboxLeadsLogEvent.WebsiteLeadWoke, { leadId: facts.leadId, agentId, route: first.route })
        return true
    }
}
