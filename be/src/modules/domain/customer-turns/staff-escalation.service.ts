import { Injectable } from "@nestjs/common"
import { EventsService } from "@modules/domain/events"
import { OfficeLinesService } from "@modules/domain/messages"
import { StaffService } from "@modules/domain/staff"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import type { Escalation } from "./customer-turns.contracts"
import { clipText } from "./customer-turn.policy"
import { handleAmong, isAdvisorRole } from "./staff-handle.policy"

/** The Office department whose agent speaks for a customer question. */
const CHATBOT_DEPARTMENT = "chatbot"
const QUESTION_MAX = 400
const PROPOSED_MAX = 300

@Injectable()
/**
 * The Office is one group chat of people and AI. When the Chatbot cannot answer alone, the waiting item is assigned to the staff member
 * who advises customers (a sales or customer-care role, else the oldest active colleague) and the Chatbot tags them in the Office with
 * the customer's question and its own draft. A workspace with no active staff keeps the item for the owner. It never throws: the item
 * already waits in Decisions either way.
 */
export class StaffEscalationService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly staff: StaffService,
        private readonly items: WorkItemsService,
        private readonly office: OfficeLinesService,
        private readonly events: EventsService,
    ) {}

    /** Assigns the waiting item and tags the person in the Office; answers whether someone was tagged. */
    async escalate(workspaceId: string, escalation: Escalation, locale: Locale): Promise<boolean> {
        try {
            const active = (await this.staff.list(workspaceId)).filter((member) => member.active)
            const person = active.find((member) => isAdvisorRole(member.role)) ?? active[0]
            if (person === undefined) return false
            const assigned = await this.items.assign(workspaceId, escalation.workItemId, person.id)
            if (!assigned) return false
            const name = escalation.customerName.trim() || this.text("staffCustomerUnknown", {}, locale)
            const proposed = escalation.proposed?.trim() ?? ""
            const body =
                this.text(
                    "staffAsk",
                    {
                        handle: handleAmong(active, person.id),
                        name,
                        question: clipText(escalation.question.trim(), QUESTION_MAX),
                    },
                    locale,
                ) +
                (proposed === ""
                    ? ""
                    : this.text("staffAskDraft", { proposed: clipText(proposed, PROPOSED_MAX) }, locale))
            await this.events.record({
                workspaceId,
                leadId: escalation.leadId,
                workItemId: escalation.workItemId,
                kind: "work.assigned",
                actor: "NIVO",
                summary: `→ ${person.name}`,
            })
            await this.office.post(
                { workspaceId },
                { body, lead_id: escalation.leadId, work_item_id: escalation.workItemId, dept: CHATBOT_DEPARTMENT },
            )
            return true
        } catch (cause) {
            this.logger.error(CustomerTurnsLogEvent.EscalationFailed, cause, { workItemId: escalation.workItemId })
            return false
        }
    }

    private text(key: string, params: Readonly<Record<string, string>>, locale: Locale): string {
        return this.catalog.get(`customerTurns.${key}`, params, locale)
    }
}
