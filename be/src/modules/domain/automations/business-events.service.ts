import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationsLogEvent } from "./automations.log-events"
import type { BusinessEventInput, CreatedLead } from "./automations.contracts"
import { eventDataOf } from "./policies/trigger.policy"

@Injectable()
/**
 * The door other capabilities announce a business fact through (a lead was created, a deal was won) after their own write, outside
 * any request of a person: the automations that are on for the event start. An announcement never fails the write it follows.
 */
export class BusinessEventsService {
    constructor(
        private readonly engine: AutomationEngineService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Starts the pipelines of the workspace that are on for the event; the dedupe key makes a repeat start nothing. */
    async announce(workspaceId: string, event: BusinessEventInput): Promise<void> {
        try {
            await this.engine.onBusinessEvent({
                workspaceId,
                event: event.event,
                dedupe: event.dedupe,
                data: eventDataOf(event.data),
            })
        } catch (cause) {
            this.logger.error(AutomationsLogEvent.AnnounceFailed, cause, { workspaceId, event: event.event })
        }
    }

    /** A new lead: `lead.created` once per lead (a repeat of the same lead starts nothing). */
    leadCreated(workspaceId: string, lead: CreatedLead, origin: string): Promise<void> {
        return this.announce(workspaceId, {
            event: "lead.created",
            dedupe: `lead.created:${lead.id}`,
            data: {
                lead_id: lead.id,
                name: lead.contact_name,
                company: lead.company,
                channel: lead.channel,
                need: lead.need,
                phone: lead.phone,
                email: lead.email,
                origin,
            },
        })
    }
}
