import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EventsReadService } from "@modules/domain/events"
import { ExecutionsFiguresService } from "@modules/domain/executions"
import { LeadReadService } from "@modules/domain/leads"
import { ResponsibilityReadService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LeadWait, PromoChatbotState, PromoState, WebsiteLeadStats } from "./promo.contracts"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"

const FOUNDING_KIND = "module.purchased"
/** The event kinds that answer a website lead for the first time. */
const FIRST_RESPONSE_KINDS = ["execution.approved", "responsibility.assigned"] as const
/** The title patterns of the invoice-preparation step, in the two languages the rows were written in. */
const INVOICE_TITLES = ["Prepare invoice%", INVOICE_TITLE_PREFIX] as const
/** How many invoice-preparation steps are checked for an approved execution. */
const INVOICE_STEP_LIMIT = 5000
const HOUR_MS = 3_600_000
/** Bangkok is a fixed UTC+7 all year. */
const BANGKOK_OFFSET_HOURS = 7
const OPENING_HOUR = 8
const CLOSING_HOUR = 18
const WEBSITE_CHANNEL = /website/i

/** A lead captured before the opening hour or from the closing hour on (Bangkok time). */
const isAfterHours = (createdAt: Date): boolean => {
    const hour = (createdAt.getUTCHours() + BANGKOK_OFFSET_HOURS) % 24
    return hour < OPENING_HOUR || hour >= CLOSING_HOUR
}

/** The text has something other than spaces in it. */
const hasText = (text: string): boolean => /[^ ]/u.test(text)

@Injectable()
/** Workspace-authorized read model for promo and onboarding facts; it does not write the source tables. */
export class PromoService {
    constructor(
        private readonly members: WorkspaceMembersService,
        @InjectClock() private readonly clock: Clock,
        private readonly agents: AgentDirectoryService,
        private readonly events: EventsReadService,
        private readonly leads: LeadReadService,
        private readonly conversations: AgentConversationsReadService,
        private readonly executions: ExecutionsFiguresService,
        private readonly responsibilities: ResponsibilityReadService,
    ) {}

    /** The earliest chatbot installed in the caller's workspace. */
    async chatbot(userId: string, workspaceId: string): Promise<PromoChatbotState> {
        await this.members.require(userId, workspaceId)
        const agent = await this.agents.earliestSheetOfModule(workspaceId, "chatbot")
        return {
            hasChatbot: agent !== null,
            agentId: agent?.id ?? null,
            handle: agent?.handle ?? null,
            name: agent?.name ?? null,
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
        return this.purchasedInOffer(workspaceId)
    }

    /** Recorded website lead counts and onboarding completion, preserving the existing promo_state semantics. */
    async state(userId: string, workspaceId: string): Promise<PromoState> {
        await this.members.require(userId, workspaceId)
        const [chatbot, isFoundingMember, websiteLeadStats, activity] = await Promise.all([
            this.agents.earliestSheetOfModule(workspaceId, "chatbot"),
            this.purchasedInOffer(workspaceId),
            this.websiteStats(workspaceId),
            this.activity(workspaceId),
        ])
        const chatbotId = chatbot?.id ?? null
        const installHref = "/modules/new?module=chatbot"
        const chatHref = chatbotId === null ? installHref : `/modules/${chatbotId}/chat`
        return {
            hasChatbot: chatbotId !== null,
            chatbotAgentId: chatbotId,
            isFoundingMember,
            websiteLeadStats,
            onboarding: [
                { key: "Buy", done: chatbotId !== null, href: installHref },
                {
                    key: "Knowledge",
                    done: chatbot !== null && hasText(chatbot.knowledge),
                    href: chatbotId === null ? installHref : `/modules/${chatbotId}`,
                },
                { key: "Test", done: activity.hasCustomerConversation, href: chatHref },
                { key: "Lead", done: activity.hasLeadConversation, href: chatHref },
                { key: "Approve", done: activity.hasApproved, href: "/chat" },
                { key: "Won", done: activity.hasWon, href: "/leads" },
                { key: "Invoice", done: activity.invoiceApproved, href: "/responsibilities" },
            ],
        }
    }

    /** Missing leads and leads with a chatbot hide the wait note, just as the existing frontend reader did. */
    async leadWait(userId: string, workspaceId: string, leadId: string): Promise<LeadWait> {
        await this.members.require(userId, workspaceId)
        const [lead] = await this.leads.listByIds(workspaceId, [leadId])
        if (lead === undefined || !WEBSITE_CHANNEL.test(lead.channel)) return this.noWait()
        if ((await this.agents.earliestSheetOfModule(workspaceId, "chatbot")) !== null) return this.noWait()
        const reply = await this.events.firstAtOfKind(workspaceId, leadId, "execution.approved")
        const waited = Math.floor(((reply ?? this.clock.now()).getTime() - Date.parse(lead.created_at)) / HOUR_MS)
        return { show: true, hours: waited >= 1 ? waited : null, replied: reply !== null }
    }

    /** The wait note of a lead it does not apply to. */
    private noWait(): LeadWait {
        return { show: false, hours: null, replied: false }
    }

    /** Whether a module purchase falls inside the founding campaign window. */
    private purchasedInOffer(workspaceId: string): Promise<boolean> {
        return this.events.existsOfKindBetween(
            workspaceId,
            FOUNDING_KIND,
            new Date(FOUNDING_OFFER.startsAt),
            new Date(FOUNDING_OFFER.endsAt),
        )
    }

    /** The website lead counts and the mean wait to the first response. */
    private async websiteStats(workspaceId: string): Promise<WebsiteLeadStats> {
        const website = await this.leads.websiteOf(workspaceId)
        const firsts = await this.events.firstAtByLead(
            workspaceId,
            FIRST_RESPONSE_KINDS,
            website.map((lead) => lead.id),
        )
        const firstAt = new Map(firsts.map((first) => [first.leadId, first.at]))
        const waits = website.flatMap((lead) => {
            const at = firstAt.get(lead.id)
            return at === undefined || at < lead.createdAt ? [] : [(at.getTime() - lead.createdAt.getTime()) / HOUR_MS]
        })
        return {
            count: website.length,
            afterHoursCount: website.filter((lead) => isAfterHours(lead.createdAt)).length,
            avgWaitHours: waits.length === 0 ? null : waits.reduce((sum, wait) => sum + wait, 0) / waits.length,
        }
    }

    /** The conversation, approval, win and invoice facts of the onboarding steps. */
    private async activity(workspaceId: string): Promise<{
        readonly hasCustomerConversation: boolean
        readonly hasLeadConversation: boolean
        readonly hasApproved: boolean
        readonly hasWon: boolean
        readonly invoiceApproved: boolean
    }> {
        const [hasCustomerConversation, hasLeadConversation, approved, won, invoiceSteps] = await Promise.all([
            this.conversations.hasCustomerChat(workspaceId),
            this.conversations.hasLeadChat(workspaceId),
            this.executions.countApproved(workspaceId),
            this.leads.idsAtStage(workspaceId, "won"),
            this.responsibilities.idsTitledLike(workspaceId, INVOICE_TITLES, INVOICE_STEP_LIMIT),
        ])
        const [hasWon, invoiceApproved] = await Promise.all([
            this.events.existsOfKindForLeads(workspaceId, "outcome.recorded", won),
            this.executions.hasApprovedAmong(workspaceId, invoiceSteps),
        ])
        return {
            hasCustomerConversation,
            hasLeadConversation,
            hasApproved: approved > 0,
            hasWon,
            invoiceApproved,
        }
    }
}
