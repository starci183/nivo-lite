import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type { DueItem, OfferIdea } from "./content-items.contracts"
import { INSERT_OFFER_IDEA, SELECT_ITEMS_BETWEEN, SELECT_OFFER_ITEM } from "./persistence/content-items.sql"
import type { InsertedRow, ItemRow, OfferItemRow } from "./persistence/content-items.rows"

@Injectable()
/** The `content_items` rows the content automations touch: the posts due in a window and the ideas an offer makes. */
export class ContentItemsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The posts of a workspace due in a window of ISO instants, soonest first. */
    async listBetween(workspaceId: string, from: string, to: string): Promise<Array<DueItem>> {
        const rows = await this.entityManager.query<Array<ItemRow>>(SELECT_ITEMS_BETWEEN, [workspaceId, from, to])
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            status: row.status,
            channels: row.channels,
            scheduledAt: row.scheduled_at,
            pillarId: row.pillar_id,
        }))
    }

    /** True when an earlier tick already made a post idea with this title. */
    async hasOffer(workspaceId: string, title: string): Promise<boolean> {
        const rows = await this.entityManager.query<Array<OfferItemRow>>(SELECT_OFFER_ITEM, [workspaceId, title])
        return rows.length > 0
    }

    /** Writes the idea of a post about an offer and answers its id. */
    async createOfferIdea(idea: OfferIdea): Promise<string> {
        const [row] = await this.entityManager.query<Array<InsertedRow>>(INSERT_OFFER_IDEA, [
            idea.workspaceId,
            idea.title,
            idea.brief,
            idea.pillarId,
            idea.channels,
            idea.evidence,
        ])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return row.id
    }
}
