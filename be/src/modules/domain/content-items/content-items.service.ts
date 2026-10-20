import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type {
    AgentDraft,
    AgentDraftRef,
    DueItem,
    OfferIdea,
    OptionalScheduleView,
    ScheduledChannelMark,
} from "./content-items.contracts"
import {
    INSERT_AGENT_DRAFT,
    INSERT_OFFER_IDEA,
    MARK_ITEM_SCHEDULED,
    SELECT_ITEMS_BETWEEN,
    SELECT_OFFER_ITEM,
    SELECT_SCHEDULE_ITEM,
} from "./persistence/content-items.sql"
import type {
    AgentDraftRow,
    InsertedRow,
    ItemRow,
    OfferItemRow,
    ScheduleItemRow,
} from "./persistence/content-items.rows"

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

    /** Stores a post an agent drafted, with its images, as a `draft`; answers the snapshot its submission is checked against. */
    async createAgentDraft(draft: AgentDraft): Promise<AgentDraftRef> {
        const [row] = await this.entityManager.query<Array<AgentDraftRow>>(INSERT_AGENT_DRAFT, [
            draft.workspaceId,
            draft.title.slice(0, 200),
            draft.brief,
            draft.channels,
            draft.scheduledAt,
            JSON.stringify(draft.variants),
            draft.hashtags,
            JSON.stringify(draft.imagePaths.map((path, index) => ({ kind: "image", name: `${index + 1}.png`, path }))),
            JSON.stringify([{ at: draft.at, kind: "drafted", by: draft.actor, text: draft.evidenceText }]),
            draft.actor,
        ])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return { id: row.id, variants: row.variants, channels: row.channels }
    }

    /** A post as the scheduler reads it, or null when it is gone. */
    async scheduleViewOf(workspaceId: string, id: string): Promise<OptionalScheduleView> {
        const [row] = await this.entityManager.query<Array<ScheduleItemRow>>(SELECT_SCHEDULE_ITEM, [workspaceId, id])
        if (row === undefined) return null
        return {
            id: row.id,
            title: row.title,
            channels: row.channels,
            texts: Object.fromEntries(row.channels.map((channel) => [channel, row.variants[channel]?.text ?? ""])),
            mediaPaths: row.media.flatMap((media) => (media.path ? [media.path] : [])),
            scheduledAt: row.scheduled_at,
        }
    }

    /** Records where each network scheduled the post. */
    async markScheduled(workspaceId: string, id: string, marks: ReadonlyArray<ScheduledChannelMark>): Promise<void> {
        const published = Object.fromEntries(
            marks.map((mark) => [mark.channel, { ref: mark.ref, scheduled_at: mark.scheduledAt }]),
        )
        await this.entityManager.query(MARK_ITEM_SCHEDULED, [workspaceId, id, JSON.stringify(published)])
    }
}
