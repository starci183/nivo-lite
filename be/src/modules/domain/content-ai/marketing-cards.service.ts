import { Injectable } from "@nestjs/common"
import { OfficeLinesService } from "@modules/domain/messages"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type { MarketingCard } from "./marketing-cards.contracts"

/** The department whose agent speaks the cards. */
const DEPARTMENT = "content"

/** Where a card goes: the workspace and the language of its text line. */
export interface CardScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The language of the line. */
    readonly locale: Locale
}

@Injectable()
/**
 * The adapter between the AI Marketing flow and the Hub. Until the Hub card contract lands, a card is posted as an Office line of the
 * AI Marketing agent whose text summarises the card (the payload shapes are in `marketing-cards.contracts.ts` and
 * `contracts/marketing-cards.md`); the integrator swaps `emit` for the Hub card writer and keeps every caller unchanged.
 */
export class MarketingCardsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly lines: OfficeLinesService,
    ) {}

    /** Posts one card into the Marketing room; answers the text line it posted. */
    async emit(scope: CardScope, card: MarketingCard): Promise<string> {
        const body = this.textOf(scope.locale, card)
        await this.lines.post(
            { workspaceId: scope.workspaceId },
            { body, lead_id: null, work_item_id: card.workItemId, dept: DEPARTMENT },
        )
        return body
    }

    /** Posts a plain line of the AI Marketing agent (a failure the owner should see). */
    async line(scope: CardScope, body: string, workItemId: string | null): Promise<void> {
        await this.lines.post(
            { workspaceId: scope.workspaceId },
            { body, lead_id: null, work_item_id: workItemId, dept: DEPARTMENT },
        )
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
