import { Injectable } from "@nestjs/common"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { MarketingCard } from "./marketing-cards.contracts"

/** The module whose agent (AI Marketing) speaks to the owner. */
const DEPARTMENT = "content"

/** The longest key a line is kept under: a retried line of the same work item and words is the same line. */
const KEY_MAX = 160

/** Where a card goes: the workspace and the language of its text line. */
export interface CardScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The language of the line. */
    readonly locale: Locale
}

@Injectable()
/**
 * The adapter between the AI Marketing flow and the team chat: a card is said to the owner as one text line of the AI
 * Marketing agent in their direct room.
 */
export class MarketingCardsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly chat: TeamChatRoomsService,
    ) {}

    /** Says what a card reads as to the owner as AI Marketing (the team chat has text lines only); answers that text. */
    async emit(scope: CardScope, card: MarketingCard): Promise<string> {
        const body = this.textOf(scope.locale, card)
        await this.line(scope, body, card.workItemId)
        return body
    }

    /** Says a plain line as AI Marketing to the owner (a failure the owner should see), once per work item and words; nothing happens without a content agent. */
    async line(scope: CardScope, body: string, workItemId: string | null): Promise<void> {
        const key = workItemId === null ? null : `${workItemId}:${body}`.slice(0, KEY_MAX)
        await this.chat.postAsAgent(scope.workspaceId, { agent: DEPARTMENT, toUserId: null, body, key })
    }

    /** The one text line a card reads as without the Hub card renderer. */
    textOf(locale: Locale, card: MarketingCard): string {
        const text = (key: string, params: Readonly<Record<string, string>>): string =>
            this.catalog.get(key, params, locale)
        switch (card.kind) {
            case "draft_post":
                return text("marketing.draftCard", { title: card.title })
            case "approval_request":
                return text("marketing.approvalCard", { title: card.title, channels: card.channels.join(", ") })
            case "schedule_confirmed":
                return text("marketing.scheduledCard", {
                    title: card.title,
                    at: card.scheduledAt,
                    channels: card.channels.map((entry) => entry.channel).join(", "),
                })
            case "weekly_report":
                return text("marketing.reportCard", {
                    from: card.report.weekStart,
                    to: card.report.weekEnd,
                    reach: String(card.report.reach.value),
                    engagements: String(card.report.engagements.value),
                    messages: String(card.report.messages.value),
                })
        }
    }
}
