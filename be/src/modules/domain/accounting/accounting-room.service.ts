import { Injectable } from "@nestjs/common"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import type { HubCardPayload } from "./accounting-desk.contracts"

/** The department whose agent (AI Ke toan) speaks in the accounting room. */
export const ACCOUNTING_DEPARTMENT = "accounting"

/** The Hub room of the accounting desk. */
const ACCOUNTING_ROOM = "accounting"

/** The card as the Hub contract v1 stores it: every line carries its marker (empty when the desk gave none). */
export const officeCardOf = (card: HubCardPayload): HubCardPayload =>
    card.lines === undefined
        ? card
        : { ...card, lines: card.lines.map((line) => ({ at: line.at ?? "", text: line.text })) }

@Injectable()
/** The adapter to the accounting room of the Hub: plain lines and result cards spoken by the accounting agent. */
export class AccountingRoomService {
    constructor(
        private readonly lines: OfficeLinesService,
        private readonly cards: OfficeCardsService,
    ) {}

    /** Posts one line as AI Ke toan. */
    async post(workspaceId: string, body: string): Promise<void> {
        await this.lines.post({ workspaceId }, { body, lead_id: null, work_item_id: null, dept: ACCOUNTING_DEPARTMENT })
    }

    /** Posts a hub card (contract v1) into the accounting room, with its plain-text fallback as the preview line. */
    async postCard(workspaceId: string, card: HubCardPayload, text: string): Promise<HubCardPayload> {
        await this.cards.postAsDepartment({ workspaceId }, ACCOUNTING_DEPARTMENT, {
            room: ACCOUNTING_ROOM,
            body: text,
            leadId: null,
            workItemId: null,
            card: officeCardOf(card),
        })
        return card
    }
}
