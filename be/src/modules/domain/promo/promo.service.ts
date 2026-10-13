import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { FoundingMemberRow, LeadWaitRow, PromoChatbotRow, PromoStateRow } from "./persistence/promo.rows"
import { FIND_FOUNDING_MEMBER, FIND_LEAD_WAIT, FIND_PROMO_CHATBOT, FIND_PROMO_STATE } from "./persistence/promo.sql"
import type { LeadWait, PromoChatbotState, PromoState } from "./promo.contracts"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"

@Injectable()
/** Workspace-authorized read model for promo and onboarding facts; it does not write the source tables. */
export class PromoService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The earliest chatbot installed in the caller's workspace. */
    async chatbot(userId: string, workspaceId: string): Promise<PromoChatbotState> {
        await this.members.require(userId, workspaceId)
        const row = (await this.entityManager.query<Array<PromoChatbotRow>>(FIND_PROMO_CHATBOT, [workspaceId]))[0]
        return {
            hasChatbot: row !== undefined,
            agentId: row?.id ?? null,
            handle: row?.handle ?? null,
            name: row?.name ?? null,
        }
    }

    /** A founding purchase counts for the standalone campaign badge only while the offer is live. */
    async foundingMember(userId: string, workspaceId: string): Promise<boolean> {
        await this.members.require(userId, workspaceId)
        const now = this.clock.now().getTime()
        if (
            !FOUNDING_OFFER.enabled ||
            now < Date.parse(FOUNDING_OFFER.startsAt) ||
            now > Date.parse(FOUNDING_OFFER.endsAt)
        ) {
            return false
        }
        const row = (
            await this.entityManager.query<Array<FoundingMemberRow>>(FIND_FOUNDING_MEMBER, [
                workspaceId,
                FOUNDING_OFFER.startsAt,
                FOUNDING_OFFER.endsAt,
            ])
        )[0]
        return row?.is_founding_member ?? false
    }

    /** Recorded website lead counts and onboarding completion, preserving the existing promo_state semantics. */
    async state(userId: string, workspaceId: string): Promise<PromoState> {
        await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<PromoStateRow>>(FIND_PROMO_STATE, [
            workspaceId,
            FOUNDING_OFFER.startsAt,
            FOUNDING_OFFER.endsAt,
            INVOICE_TITLE_PREFIX,
        ])
        const chatbotId = row?.chatbot_id ?? null
        const installHref = "/modules/new?module=chatbot"
        const chatHref = chatbotId === null ? installHref : `/modules/${chatbotId}/chat`
        return {
            hasChatbot: chatbotId !== null,
            chatbotAgentId: chatbotId,
            isFoundingMember: row?.is_founding_member ?? false,
            websiteLeadStats: {
                count: row?.website_count ?? 0,
                afterHoursCount: row?.after_hours_count ?? 0,
                avgWaitHours: row?.avg_wait_hours ?? null,
            },
            onboarding: [
                { key: "Buy", done: chatbotId !== null, href: installHref },
                {
                    key: "Knowledge",
                    done: row?.has_knowledge ?? false,
                    href: chatbotId === null ? installHref : `/modules/${chatbotId}`,
                },
                { key: "Test", done: row?.has_customer_conversation ?? false, href: chatHref },
                { key: "Lead", done: row?.has_lead_conversation ?? false, href: chatHref },
                { key: "Approve", done: row?.has_approved ?? false, href: "/chat" },
                { key: "Won", done: row?.has_won ?? false, href: "/leads" },
                { key: "Invoice", done: row?.invoice_approved ?? false, href: "/responsibilities" },
            ],
        }
    }

    /** Missing leads and leads with a chatbot hide the wait note, just as the existing frontend reader did. */
    async leadWait(userId: string, workspaceId: string, leadId: string): Promise<LeadWait> {
        await this.members.require(userId, workspaceId)
        const row = (
            await this.entityManager.query<Array<LeadWaitRow>>(FIND_LEAD_WAIT, [
                workspaceId,
                leadId,
                this.clock.now().toISOString(),
            ])
        )[0]
        return row ?? { show: false, hours: null, replied: false }
    }
}
