import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { ResponsibilityEntity } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { LeadWait, PromoChatbotState, PromoState } from "./promo.contracts"
import { FOUNDING_OFFER, INVOICE_TITLE_PREFIX } from "./promo.templates"

/** The earliest chatbot of a workspace as the chatbot card reads it. */
interface ChatbotFacts {
    /** The installed chatbot identifier. */
    readonly id: string
    /** The installed chatbot handle. */
    readonly handle: string
    /** The installed chatbot display name. */
    readonly name: string
}

/** Aggregated facts of the promo read model. */
interface PromoStateFacts {
    /** The earliest installed chatbot identifier, when present. */
    readonly chatbot_id: string | null
    /** Whether the chatbot has nonempty knowledge text. */
    readonly has_knowledge: boolean
    /** Whether a module purchase occurred inside the campaign window. */
    readonly is_founding_member: boolean
    /** The website-channel lead count. */
    readonly website_count: number
    /** Website leads captured before 08:00 or after 18:00 (Bangkok time). */
    readonly after_hours_count: number
    /** The mean hours to the earliest response event. */
    readonly avg_wait_hours: number | null
    /** Whether a customer conversation exists. */
    readonly has_customer_conversation: boolean
    /** Whether a conversation has a captured lead. */
    readonly has_lead_conversation: boolean
    /** Whether an execution has been approved. */
    readonly has_approved: boolean
    /** Whether an outcome event belongs to a won lead. */
    readonly has_won: boolean
    /** Whether an invoice preparation responsibility was approved. */
    readonly invoice_approved: boolean
}

/** The bounded lead wait projection. */
interface LeadWaitFacts {
    /** Whether the website lead wait note applies. */
    readonly show: boolean
    /** Whole hours waiting, when at least one hour is recorded. */
    readonly hours: number | null
    /** Whether an approved reply exists. */
    readonly replied: boolean
}

const WEBSITE_CHANNEL = "%website%"
const BANGKOK_HOUR = "EXTRACT(HOUR FROM w.created_at AT TIME ZONE 'Asia/Bangkok')"
const CHATBOT_OF_WORKSPACE = "a.workspace_id = :workspaceId AND a.module = 'chatbot'"
const FOUNDING_WINDOW = "e.created_at >= :startsAt::timestamptz AND e.created_at <= :endsAt::timestamptz"

/** The sub query readers of the promo facts, all built from one outer query builder. */
interface FactReaders {
    /** The outer query builder the facts are selected on. */
    readonly query: SelectQueryBuilder<object>
    /** One fact of the earliest chatbot of the workspace. */
    readonly chatbot: (select: string) => string
    /** An EXISTS test over a workspace-scoped sub query. */
    readonly exists: ExistsReader
    /** The website lead sub query selecting the given expression. */
    readonly website: (select: string) => SelectQueryBuilder<object>
}

/** Reads one existence fact: the callback shapes the sub query, the answer is the EXISTS fragment. */
type ExistsReader = (read: (sub: SelectQueryBuilder<object>) => SelectQueryBuilder<object>) => string

const factReaders = (query: SelectQueryBuilder<object>): FactReaders => ({
    query,
    chatbot: (select) =>
        query
            .subQuery()
            .select(select, "fact")
            .from("public.agents", "a")
            .where(CHATBOT_OF_WORKSPACE)
            .orderBy("a.created_at")
            .addOrderBy("a.id")
            .limit(1)
            .getQuery(),
    exists: (read) => `EXISTS ${read(query.subQuery().select("1")).getQuery()}`,
    website: (select) =>
        query
            .subQuery()
            .select(select)
            .from("public.leads", "w")
            .where("w.workspace_id = :workspaceId AND w.channel ILIKE :website"),
})

/** The website lead counts and the mean wait to the first response. */
const selectWebsiteFacts = (query: SelectQueryBuilder<object>, { website }: FactReaders): SelectQueryBuilder<object> =>
    query
        .addSelect(website("COUNT(*)::int").getQuery(), "website_count")
        .addSelect(
            website("COUNT(*)::int").andWhere(`(${BANGKOK_HOUR} < 8 OR ${BANGKOK_HOUR} >= 18)`).getQuery(),
            "after_hours_count",
        )
        .addSelect(
            website("AVG(EXTRACT(EPOCH FROM (f.at - w.created_at)) / 3600)::float8")
                .innerJoin(
                    (sub: SelectQueryBuilder<object>) =>
                        sub
                            .select("e.lead_id", "lead_id")
                            .addSelect("MIN(e.created_at)", "at")
                            .from("public.events", "e")
                            .where(
                                "e.workspace_id = :workspaceId AND e.kind IN ('execution.approved', 'responsibility.assigned')",
                            )
                            .groupBy("e.lead_id"),
                    "f",
                    "f.lead_id = w.id",
                )
                .andWhere("f.at >= w.created_at")
                .getQuery(),
            "avg_wait_hours",
        )

/** The conversation, approval, win and invoice existence facts. */
const selectActivityFacts = (query: SelectQueryBuilder<object>, exists: ExistsReader): SelectQueryBuilder<object> =>
    query
        .addSelect(
            exists((sub) =>
                sub
                    .from("public.agent_conversations", "c")
                    .where("c.workspace_id = :workspaceId AND c.kind = 'customer'"),
            ),
            "has_customer_conversation",
        )
        .addSelect(
            exists((sub) =>
                sub
                    .from("public.agent_conversations", "c")
                    .where("c.workspace_id = :workspaceId AND c.lead_id IS NOT NULL"),
            ),
            "has_lead_conversation",
        )
        .addSelect(
            exists((sub) =>
                sub.from("public.executions", "x").where("x.workspace_id = :workspaceId AND x.status = 'approved'"),
            ),
            "has_approved",
        )
        .addSelect(
            exists((sub) =>
                sub
                    .from("public.events", "e")
                    .innerJoin("leads", "l", "l.id = e.lead_id")
                    .where("e.workspace_id = :workspaceId AND l.workspace_id = :workspaceId")
                    .andWhere("e.kind = 'outcome.recorded' AND l.stage = 'won'"),
            ),
            "has_won",
        )
        .addSelect(
            exists((sub) =>
                sub
                    .from(ResponsibilityEntity, "r")
                    .innerJoin("executions", "x", "x.responsibility_id = r.id")
                    .where("r.workspaceId = :workspaceId AND x.workspace_id = :workspaceId AND x.status = 'approved'")
                    .andWhere("(r.title ILIKE 'Prepare invoice%' OR r.title ILIKE :invoiceTitle)"),
            ),
            "invoice_approved",
        )

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
        const row = await this.entityManager
            .createQueryBuilder()
            .select("a.id", "id")
            .addSelect("a.handle", "handle")
            .addSelect("a.name", "name")
            .from("public.agents", "a")
            .where(CHATBOT_OF_WORKSPACE, { workspaceId })
            .orderBy("a.created_at")
            .addOrderBy("a.id")
            .limit(1)
            .getRawOne<ChatbotFacts>()
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
        return this.entityManager
            .createQueryBuilder()
            .select("1")
            .from("public.events", "e")
            .where("e.workspace_id = :workspaceId AND e.kind = 'module.purchased'", { workspaceId })
            .andWhere(FOUNDING_WINDOW, { startsAt: FOUNDING_OFFER.startsAt, endsAt: FOUNDING_OFFER.endsAt })
            .getExists()
    }

    /** Recorded website lead counts and onboarding completion, preserving the existing promo_state semantics. */
    async state(userId: string, workspaceId: string): Promise<PromoState> {
        await this.members.require(userId, workspaceId)
        const row = await this.stateFacts(workspaceId)
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
        const query = this.entityManager.createQueryBuilder()
        const noChatbot = query.subQuery().select("1").from("public.agents", "a").where(CHATBOT_OF_WORKSPACE).getQuery()
        const reply = query
            .subQuery()
            .select("MIN(ev.created_at)")
            .from("public.events", "ev")
            .where("ev.workspace_id = :workspaceId AND ev.lead_id = :leadId AND ev.kind = 'execution.approved'")
            .getQuery()
        const show = `l.channel ILIKE :website AND NOT EXISTS ${noChatbot}`
        const hours = `FLOOR(EXTRACT(EPOCH FROM (COALESCE(${reply}, :now::timestamptz) - l.created_at)) / 3600)`
        const row = await query
            .select(show, "show")
            .addSelect(`CASE WHEN ${show} AND ${hours} >= 1 THEN (${hours})::int ELSE NULL END`, "hours")
            .addSelect(`${show} AND ${reply} IS NOT NULL`, "replied")
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId AND l.id = :leadId", { workspaceId, leadId })
            .setParameters({ website: WEBSITE_CHANNEL, now: this.clock.now() })
            .limit(1)
            .getRawOne<LeadWaitFacts>()
        return row ?? { show: false, hours: null, replied: false }
    }

    /**
     * Every fact of the promo state in one statement anchored on the workspace row, so all of them read one snapshot; every
     * subquery is workspace-scoped. Answers undefined when the workspace row is gone, which the caller reads as no facts.
     */
    private stateFacts(workspaceId: string): Promise<PromoStateFacts | undefined> {
        const readers = factReaders(this.entityManager.createQueryBuilder())
        const { query, chatbot, exists } = readers
        const chatbotFacts = query
            .select(chatbot("a.id"), "chatbot_id")
            .addSelect(`COALESCE(${chatbot("LENGTH(BTRIM(a.knowledge)) > 0")}, false)`, "has_knowledge")
            .addSelect(
                exists((sub) =>
                    sub
                        .from("public.events", "e")
                        .where("e.workspace_id = :workspaceId AND e.kind = 'module.purchased'")
                        .andWhere(FOUNDING_WINDOW),
                ),
                "is_founding_member",
            )
        return selectActivityFacts(selectWebsiteFacts(chatbotFacts, readers), exists)
            .from("public.workspaces", "ws")
            .where("ws.id = :workspaceId", { workspaceId })
            .setParameters({
                website: WEBSITE_CHANNEL,
                startsAt: FOUNDING_OFFER.startsAt,
                endsAt: FOUNDING_OFFER.endsAt,
                invoiceTitle: INVOICE_TITLE_PREFIX,
            })
            .getRawOne<PromoStateFacts>()
    }
}
