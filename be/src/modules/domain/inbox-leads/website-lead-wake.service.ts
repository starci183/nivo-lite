import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { WebsiteIntakeLogEvent } from "./website-intake.log-events"
import type { WebsiteSubmissionFacts } from "./website-lead-wake.policy"
import { WEBSITE_FORM_TRIGGER } from "./website-form.trigger"

@Injectable()
/**
 * THE WEBSITE FORM'S ENTRY to the one event pipeline (concept triggers rule 13): an accepted form, already stored as one input and its
 * claims linked, is translated by the form's pure trigger declaration and handed to the ONE delivery function for the site's owning agent
 * (the site is the account of the visitor's identity). Nothing here writes a record of the agent or sends a message: the agent's graph
 * does what it decides. A repeat of the same form is the same event id, which the delivery keeps to one wake.
 */
export class WebsiteLeadWakeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly triggers: ProviderTriggersService,
    ) {}

    /** Delivers the accepted submission to the owning agent; answers whether a graph of the agent took it. */
    async wake(workspaceId: string, agentId: string, facts: WebsiteSubmissionFacts): Promise<boolean> {
        const event = WEBSITE_FORM_TRIGGER.translate(
            {
                siteId: facts.siteId,
                inboundEventId: facts.inboundEventId,
                visitorKey: facts.visitorKey,
                name: facts.name,
                phone: facts.phone,
                email: facts.email,
                request: facts.request,
                source: facts.source,
            },
            { connectionId: facts.siteId },
        )
        if (event === null) return false
        const delivered = await this.entityManager.transaction((tx) =>
            this.triggers.deliver(
                {
                    workspaceId,
                    declaration: WEBSITE_FORM_TRIGGER,
                    connectionId: facts.siteId,
                    agentId,
                    events: [{ event, contactId: facts.contactId }],
                },
                tx,
            ),
        )
        if (delivered.status !== "delivered" || delivered.woken.length === 0) {
            let reason: string = delivered.status
            if (delivered.status === "delivered") reason = delivered.repeats > 0 ? "duplicate" : "untaken"
            this.logger.info(WebsiteIntakeLogEvent.SubmissionNotWoken, { contactId: facts.contactId, reason })
            return false
        }
        this.logger.info(WebsiteIntakeLogEvent.SubmissionWoke, { contactId: facts.contactId, agentId })
        return true
    }
}
