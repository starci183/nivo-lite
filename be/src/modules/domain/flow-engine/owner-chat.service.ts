import { Injectable } from "@nestjs/common"
import { DecisionsService, ModuleCatalogService, WorkDecisionService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { isManagerRole } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { DomainError } from "@modules/platform/errors"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { AuthorityChatService, moneyOf } from "./authority-chat.service"
import type { ChatVerdict, OwnerChatAnswer, WaitingView } from "./flow-engine.contracts"
import {
    amountOf,
    waitingCustomerOf,
    isAddressed,
    matchWaiting,
    namesOtherHandle,
    refOf,
    verdictOf,
    withoutAddress,
} from "./owner-chat.policy"

/** How many waiting items a typed decision looks at. */
const WAITING_LIMIT = 100

/** How many waiting items a reply lists. */
const LISTED = 6

/** A message NIVO leaves to the normal Office reply. */
const UNHANDLED: OwnerChatAnswer = { handled: false, posted: false }

@Injectable()
/**
 * The owner talks to NIVO in Office: authority granted in plain words ("@nivo ...") and decisions typed in chat ("dong y",
 * "tu choi FB-1234", accents optional). A typed decision acts only when it identifies exactly one waiting item, never falls back to "the latest",
 * and never approves a payment reconciliation; otherwise NIVO lists what is waiting and changes nothing.
 */
export class OwnerChatService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly decisions: DecisionsService,
        private readonly work: WorkDecisionService,
        private readonly modules: ModuleCatalogService,
        private readonly leads: LeadRecordsService,
        private readonly authority: AuthorityChatService,
    ) {}

    /** Answers one Office message of the member; staff only get a refusal, and only when they address NIVO. */
    async reply(member: WorkspaceMember, text: string, locale: Locale): Promise<OwnerChatAnswer> {
        const raw = text.trim()
        const addressed = isAddressed(raw)
        if (!isManagerRole(member.role))
            return addressed ? this.answer(this.catalog.get("flowEngine.forbidden", {}, locale)) : UNHANDLED
        const body = withoutAddress(raw)
        if (!addressed && namesOtherHandle(body)) return UNHANDLED
        const verdict = verdictOf(body, addressed)
        if (verdict !== null) {
            const decided = await this.decideFromChat(member, body, verdict, addressed, locale)
            if (decided.handled) return decided
        }
        if (!addressed) return UNHANDLED
        return this.answering(locale, async () => (await this.authority.apply(member, body, locale)).summary)
    }

    private async decideFromChat(
        member: WorkspaceMember,
        text: string,
        verdict: ChatVerdict,
        addressed: boolean,
        locale: Locale,
    ): Promise<OwnerChatAnswer> {
        const waiting = await this.waiting(member)
        if (waiting.length === 0)
            return addressed ? this.answer(this.catalog.get("flowEngine.noWaiting", {}, locale)) : UNHANDLED
        const match = matchWaiting(text, waiting)
        const verb = this.catalog.get(
            verdict === "approved" ? "flowEngine.verbApprove" : "flowEngine.verbReject",
            {},
            locale,
        )
        const target = match.pool.length === 1 && (match.clues || waiting.length === 1) ? match.pool[0] : undefined
        if (target === undefined) {
            const shown = match.pool.length === 0 ? waiting : match.pool
            const params = {
                n: match.pool.length,
                verb,
                list: await this.listOf(shown, locale),
                example: this.example(verb, shown[0], locale),
            }
            const key = match.pool.length === 0 ? "flowEngine.noMatch" : "flowEngine.which"
            return this.answer(this.catalog.get(key, params, locale))
        }
        if (verdict === "approved" && target.item.action === "reconcile_payment") {
            const item = await this.describe(target, locale)
            return this.answer(this.catalog.get("flowEngine.reconcileNeedsCard", { item }, locale))
        }
        const fills =
            match.amount !== null && verdict === "approved" && target.item.missing_fields.includes("amount_vnd")
                ? match.amount
                : null
        return this.answering(locale, async () => {
            await this.work.decide(member.userId, member.workspaceId, {
                workItemId: target.item.id,
                decision: verdict,
                edits: fills === null ? {} : { amount_vnd: fills },
                note: this.catalog.get("flowEngine.decisionNote", {}, locale),
                locale,
            })
            const word = verdict === "approved" ? "flowEngine.approvedWord" : "flowEngine.rejectedWord"
            const summary = await this.describe(target, locale, fills ?? undefined)
            return this.catalog.get(
                "flowEngine.decided",
                { decision: this.catalog.get(word, {}, locale), summary },
                locale,
            )
        })
    }

    /** The items waiting for a decision, oldest first, with their customers. */
    private async waiting(member: WorkspaceMember): Promise<Array<WaitingView>> {
        const page = await this.decisions.listWorkItems(member.userId, member.workspaceId, {
            statuses: ["waiting_decision"],
            action: null,
            limit: WAITING_LIMIT,
        })
        const items = [...page.items].sort((a, b) => a.created_at.localeCompare(b.created_at))
        const leadIds = [...new Set(items.flatMap((item) => (item.lead_id === null ? [] : [item.lead_id])))]
        const names = new Map(
            (await this.leads.namesOf(member.workspaceId, leadIds)).map(
                (lead) => [lead.id, lead.contact_name] as const,
            ),
        )
        return items.map((item: WorkItem) => ({
            item,
            customer: waitingCustomerOf(item, item.lead_id === null ? "" : (names.get(item.lead_id) ?? "")),
            ref: refOf(item),
            amount: amountOf(item),
        }))
    }

    /** "Confirm order FB-1234, Anh Minh, 5.000.000 VND" joined by middle dots: exactly what a typed decision applies to. */
    private async describe(view: WaitingView, locale: Locale, amountOverride?: number): Promise<string> {
        const label = (await this.modules.actionOf(view.item.action))?.label[locale] ?? view.item.action
        const amount = amountOverride ?? view.amount
        const reference = view.ref === "" ? "" : " " + view.ref
        return [`${label}${reference}`, view.customer, amount === null ? "" : moneyOf(amount, locale)]
            .filter((part) => part !== "")
            .join(" \u00b7 ")
    }

    private async listOf(views: ReadonlyArray<WaitingView>, locale: Locale): Promise<string> {
        const described = await Promise.all(views.slice(0, LISTED).map((view) => this.describe(view, locale)))
        const shown = described.map((line, index) => `${index + 1}) ${line}`).join("; ")
        if (views.length <= LISTED) return shown
        return `${shown}; ${this.catalog.get("flowEngine.moreWaiting", { n: views.length - LISTED }, locale)}`
    }

    private example(verb: string, view: WaitingView | undefined, locale: Locale): string {
        if (view === undefined) return ""
        return `${verb} ${view.ref || view.customer || moneyOf(view.amount ?? 0, locale)}`
    }

    private answer(reply: string): OwnerChatAnswer {
        return { handled: true, reply, posted: false }
    }

    /** Runs a step whose refusal becomes NIVO's reply in the thread, in the owner's language. */
    private async answering(locale: Locale, step: () => Promise<string>): Promise<OwnerChatAnswer> {
        try {
            return this.answer(await step())
        } catch (error) {
            if (!(error instanceof DomainError)) throw error
            return this.answer(this.catalog.get(`errors.${String(error.code)}`, error.params, locale))
        }
    }
}
