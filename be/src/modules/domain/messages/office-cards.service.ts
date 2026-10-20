import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { MessagesError, MessagesErrorCode } from "./errors/messages.error"
import type { OfficeCardPost, OptionalRoom } from "./office-cards.contracts"
import type { MessagesScope } from "./office-lines.contracts"
import { parseOfficeCard } from "./office-card.policy"
import { INSERT_CARD_MESSAGE } from "./persistence/office-lines.sql"

/** The stored card line: its id and the room it landed in. */
export interface PostedCard {
    /** The message id. */
    readonly id: string
    /** The room the line landed in; null is the general Office room. */
    readonly room: OptionalRoom
}

@Injectable()
/** Agent result cards in the Hub: one validated card line per call, spoken by the agent, in a room or routed by the database. */
export class OfficeCardsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Validates the payload against the card contract and stores the line; a broken payload is refused with its reason. */
    async post(ctx: MessagesScope, line: OfficeCardPost): Promise<PostedCard> {
        const parsed = parseOfficeCard(line.card)
        if (!parsed.ok)
            throw new MessagesError({ code: MessagesErrorCode.CardInvalid, params: { reason: parsed.reason } })
        const body = line.body.trim() === "" ? parsed.card.title : line.body.trim()
        const [row] = await this.entityManager.query<Array<PostedCard>>(INSERT_CARD_MESSAGE, [
            ctx.workspaceId,
            line.agentId === null ? "system" : "agent",
            line.authorName,
            line.agentId,
            body,
            line.leadId,
            line.workItemId,
            line.room,
            JSON.stringify(parsed.card),
        ])
        return row ?? { id: "", room: line.room }
    }
}
