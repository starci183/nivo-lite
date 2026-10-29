import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type {
    AgentDraft,
    AgentDraftRef,
    DueChannelPost,
    DueItem,
    OfferIdea,
    OptionalScheduleView,
    ScheduleView,
    ScheduledChannelMark,
} from "./content-items.contracts"
import { ISO_TEXT, draftRefOf, returnedRows } from "./persistence/content-item.projection"
import type { DueChannelProjection, ScheduleProjection } from "./persistence/content-item.projection"
import { ContentItemEntity } from "./persistence/entities"

/** A stored post as the scheduler reads it: the text of each channel and the attached media paths. */
const scheduleViewOfRow = (row: ScheduleProjection): ScheduleView => ({
    id: row.id,
    title: row.title,
    channels: row.channels,
    texts: Object.fromEntries(row.channels.map((channel) => [channel, row.variants[channel]?.text ?? ""])),
    mediaPaths: row.media.flatMap((media) => (media.path ? [media.path] : [])),
    scheduledAt: row.scheduledAt,
})

@Injectable()
/** The `content_items` rows the content automations touch: the posts due in a window and the ideas an offer makes. */
export class ContentItemsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The posts of a workspace due in a window of ISO instants, soonest first. */
    async listBetween(workspaceId: string, from: string, to: string): Promise<Array<DueItem>> {
        const rows = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "c")
            .select("c.id", "id")
            .addSelect("c.title", "title")
            .addSelect("c.status", "status")
            .addSelect("c.channels", "channels")
            .addSelect(ISO_TEXT("c.scheduled_at"), "scheduledAt")
            .addSelect("c.pillar_id", "pillarId")
            .where("c.workspaceId = :workspaceId AND c.scheduledAt >= :from AND c.scheduledAt < :to", {
                workspaceId,
                from,
                to,
            })
            .orderBy("c.scheduledAt")
            .limit(500)
            .getRawMany<DueItem>()
        return rows.map((row) => ({ ...row }))
    }

    /** True when an earlier tick already made a post idea with this title. */
    hasOffer(workspaceId: string, title: string): Promise<boolean> {
        return this.entityManager.exists(ContentItemEntity, { where: { workspaceId, source: "offer", title } })
    }

    /** Writes the idea of a post about an offer and answers its id. */
    async createOfferIdea(idea: OfferIdea): Promise<string> {
        const inserted = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .insert()
            .values({
                workspaceId: idea.workspaceId,
                title: idea.title,
                brief: idea.brief,
                pillarId: idea.pillarId,
                channels: [...idea.channels],
                status: "idea",
                source: "offer",
                createdBy: "NIVO",
                evidence: () => ":evidence::jsonb",
            })
            .setParameter("evidence", idea.evidence)
            .returning("id")
            .execute()
        const [row] = returnedRows(inserted.raw)
        const id: unknown = row === undefined ? undefined : Reflect.get(row, "id")
        if (typeof id !== "string") throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return id
    }

    /** Stores a post an agent drafted, with its images, as a `draft`; answers the snapshot its submission is checked against. */
    async createAgentDraft(draft: AgentDraft): Promise<AgentDraftRef> {
        const inserted = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .insert()
            .values({
                workspaceId: draft.workspaceId,
                title: draft.title.slice(0, 200),
                brief: draft.brief,
                channels: [...draft.channels],
                scheduledAt: () => ":scheduledAt::timestamptz",
                status: "draft",
                variants: () => ":variants::jsonb",
                hashtags: [...draft.hashtags],
                media: () => ":media::jsonb",
                evidence: () => ":evidence::jsonb",
                source: "quick",
                createdBy: draft.actor,
                draftedAt: () => "now()",
            })
            .setParameters({
                scheduledAt: draft.scheduledAt,
                variants: JSON.stringify(draft.variants),
                media: JSON.stringify(
                    draft.imagePaths.map((path, index) => ({ kind: "image", name: `${index + 1}.png`, path })),
                ),
                evidence: JSON.stringify([
                    { at: draft.at, kind: "drafted", by: draft.actor, text: draft.evidenceText },
                ]),
            })
            .returning("id, variants, channels")
            .execute()
        const [row] = returnedRows(inserted.raw)
        const stored = row === undefined ? undefined : draftRefOf(row)
        if (stored === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return stored
    }

    /** A post as the scheduler reads it, or null when it is gone. */
    async scheduleViewOf(workspaceId: string, id: string): Promise<OptionalScheduleView> {
        const row = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "c")
            .select("c.id", "id")
            .addSelect("c.title", "title")
            .addSelect("c.channels", "channels")
            .addSelect("c.variants", "variants")
            .addSelect("c.media", "media")
            .addSelect("to_json(c.scheduled_at) #>> '{}'", "scheduledAt")
            .where("c.workspaceId = :workspaceId AND c.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<ScheduleProjection>()
        return row === undefined ? null : scheduleViewOfRow(row)
    }

    /** The approved posts of every workspace whose moment on `channel` has come and that it has not published or refused, oldest first. */
    async dueOnChannel(channel: string, now: string, limit: number): Promise<Array<DueChannelPost>> {
        const rows = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "c")
            .select("c.workspace_id", "workspaceId")
            .addSelect("c.id", "id")
            .addSelect("c.title", "title")
            .addSelect("c.channels", "channels")
            .addSelect("c.variants", "variants")
            .addSelect("c.media", "media")
            .addSelect("to_json(c.scheduled_at) #>> '{}'", "scheduledAt")
            .addSelect("c.published -> :channel::text ->> 'ref'", "ref")
            .where("c.status = 'approved' AND (c.published -> :channel::text) ? 'ref'", { channel })
            .andWhere("NOT ((c.published -> :channel::text) ? 'failed_at')")
            .andWhere("(c.published -> :channel::text ->> 'scheduled_at')::timestamptz <= :now::timestamptz", { now })
            .orderBy("(c.published -> :channel::text ->> 'scheduled_at')::timestamptz")
            .limit(limit)
            .getRawMany<DueChannelProjection>()
        return rows.map((row) => ({ ...scheduleViewOfRow(row), workspaceId: row.workspaceId, ref: row.ref }))
    }

    /** Records that `channel` refused a due post, with why, so the scheduler does not retry it. */
    async markChannelFailed(
        workspaceId: string,
        id: string,
        channel: string,
        reason: string,
        at: string,
    ): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({
                published: () =>
                    "jsonb_set(published, ARRAY[:channel::text], COALESCE(published -> :channel::text, '{}'::jsonb) || jsonb_build_object('failed_at', :at::text, 'reason', :reason::text))",
                updatedAt: () => "now()",
            })
            .where({ workspaceId, id })
            .setParameters({ channel, at, reason: reason.slice(0, 300) })
            .execute()
    }

    /** Records where each network scheduled the post. */
    async markScheduled(workspaceId: string, id: string, marks: ReadonlyArray<ScheduledChannelMark>): Promise<void> {
        const published = Object.fromEntries(
            marks.map((mark) => [mark.channel, { ref: mark.ref, scheduled_at: mark.scheduledAt }]),
        )
        await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({ published: () => "jsonb_concat(published, CAST(:published AS jsonb))", updatedAt: () => "now()" })
            .where({ workspaceId, id })
            .setParameter("published", JSON.stringify(published))
            .execute()
    }
}
