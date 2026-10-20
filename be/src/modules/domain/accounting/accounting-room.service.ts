import { Injectable } from "@nestjs/common"
import { OfficeLinesService } from "@modules/domain/messages"
import type { HubCardPayload } from "./accounting-desk.contracts"

/** The department whose agent (AI Ke toan) speaks in the accounting room. */
export const ACCOUNTING_DEPARTMENT = "accounting"

@Injectable()
/**
 * The adapter to the accounting room of the Hub. Until the hub-cards contract lands it posts each card as its text fallback, a line
 * spoken by the accounting agent; the structured card is stored with the daily summary for a renderer to read.
 */
export class AccountingRoomService {
    constructor(private readonly lines: OfficeLinesService) {}

    /** Posts one line as AI Ke toan. */
    async post(workspaceId: string, body: string): Promise<void> {
        await this.lines.post({ workspaceId }, { body, lead_id: null, work_item_id: null, dept: ACCOUNTING_DEPARTMENT })
    }

    /**
     * Posts a hub card with its plain-text fallback. Today the text goes out as the line; once the hub-cards branch is merged the
     * payload goes through `OfficeCardsService.post({ room: "accounting", card })` with the same arguments.
     */
    async postCard(workspaceId: string, card: HubCardPayload, text: string): Promise<HubCardPayload> {
        await this.post(workspaceId, text)
        return card
    }
}
