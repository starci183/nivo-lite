import { VideoRendersService } from "@modules/domain/video-renders"
import { Injectable } from "@nestjs/common"
import { And, In, LessThan, MoreThanOrEqual } from "typeorm"
import type { EntityManager, FindOperator } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type {
    ContentActor,
    ContentFigures,
    ContentItem,
    ContentItemReference,
    ContentMediaRef,
    ContentRange,
    ContentWorkbench,
    CreateContentItem,
    SaveContentItem,
    PlanReader,
} from "./content-editor.contracts"
import { contentInstant, toContentItem } from "./content-editor.mapper"
import { contentChannels, contentTransition, mergeContentPatch, requireContentInput } from "./content-editor.policy"
import { contentItemOfRaw } from "./persistence/content-item.projection"
import { ContentItemEntity } from "./persistence/entities"

const OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000
/** The most themes a workspace holds. */
const PILLARS_MAX = 100

/** The window of a calendar read: half-open, with either end optional. */
const windowOf = (range: ContentRange): FindOperator<Date> | undefined => {
    const bounds = [
        ...(range.from === undefined ? [] : [MoreThanOrEqual(new Date(range.from))]),
        ...(range.to === undefined ? [] : [LessThan(new Date(range.to))]),
    ]
    return bounds.length === 0 ? undefined : And(...bounds)
}

@Injectable()
/** Content reads and editor writes over the existing content tables, with the caller's membership proved on every public operation. */
export class ContentEditorService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly pillars: ContentPillarsService,
        private readonly renders: VideoRendersService,
    ) {}

    /** The member's audit name and management permission. */
    async actor(userId: string, workspaceId: string): Promise<ContentActor> {
        const member = await this.members.require(userId, workspaceId)
        return {
            workspaceId,
            name: member.displayName,
            canManage: member.role === "owner" || member.role === "manager",
        }
    }

    /** Bounded calendar data for an authenticated member. */
    async list(userId: string, workspaceId: string, range: ContentRange = {}): Promise<Array<ContentItem>> {
        await this.members.require(userId, workspaceId)
        this.validateRange(range)
        const window = windowOf(range)
        const rows = await this.entityManager.find(ContentItemEntity, {
            where: { workspaceId, ...(window === undefined ? {} : { scheduledAt: window }) },
            order: { scheduledAt: { direction: "ASC", nulls: "LAST" }, createdAt: "DESC" },
            take: 500,
        })
        return rows.map(toContentItem)
    }

    /** A workspace-scoped row for trusted application orchestration. */
    async get(workspaceId: string, id: string): Promise<ContentItem> {
        const row = await this.entityManager.findOne(ContentItemEntity, { where: { workspaceId, id } })
        if (row === null) throw new ContentItemsError({ code: ContentItemsErrorCode.NotFound })
        return toContentItem(row)
    }

    /** An authenticated member's single post. */
    async getForUser(userId: string, workspaceId: string, id: string): Promise<ContentItem> {
        await this.members.require(userId, workspaceId)
        return this.get(workspaceId, id)
    }

    /** Owner/manager creation of a manual idea. */
    async create(userId: string, workspaceId: string, input: CreateContentItem): Promise<ContentItem> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        requireContentInput(input.title.trim() !== "")
        this.validateDate(input.scheduledAt)
        await this.requirePillar(this.entityManager, workspaceId, input.pillarId ?? null)
        const at = this.clock.now().toISOString()
        const evidence = [{ at, kind: "created", by: member.displayName, text: "created" }]
        const inserted = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "ci")
            .insert()
            .values({
                workspaceId,
                title: input.title.trim().slice(0, 200),
                channels: contentChannels(input.channels),
                scheduledAt: () => ":scheduledAt::timestamptz",
                pillarId: input.pillarId ?? null,
                status: "idea",
                source: "manual",
                createdBy: member.displayName,
                evidence: () => ":evidence::jsonb",
            })
            .setParameters({ scheduledAt: input.scheduledAt ?? null, evidence: JSON.stringify(evidence) })
            .returning("*")
            .execute()
        const row = contentItemOfRaw(inserted.raw)
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return toContentItem(row)
    }

    /** Changes only editable fields under an exclusive row lock. */
    async save(userId: string, workspaceId: string, id: string, patch: SaveContentItem): Promise<ContentItem> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        this.validateDate(patch.scheduledAt)
        return this.entityManager.transaction(async (tx) => {
            const item = await this.lock(tx, workspaceId, id)
            const next = mergeContentPatch(item, patch, workspaceId)
            await this.requirePillar(tx, workspaceId, next.pillarId)
            if (patch.media !== undefined) await this.requireMedia(workspaceId, next.media)
            const evidence = [
                ...item.evidence,
                { at: this.clock.now().toISOString(), kind: "edited", by: member.displayName, text: "edited" },
            ].slice(-60)
            const saved = await tx
                .createQueryBuilder(ContentItemEntity, "ci")
                .update()
                .set({
                    title: next.title,
                    brief: next.brief,
                    pillarId: next.pillarId,
                    channels: [...next.channels],
                    scheduledAt: () => ":scheduledAt::timestamptz",
                    variants: () => ":variants::jsonb",
                    hashtags: [...next.hashtags],
                    links: () => ":links::jsonb",
                    media: () => ":media::jsonb",
                    status: next.status,
                    draftedAt: () => ":draftedAt::timestamptz",
                    evidence: () => ":evidence::jsonb",
                })
                .where({ workspaceId, id })
                .setParameters({
                    scheduledAt: next.scheduledAt,
                    variants: JSON.stringify(next.variants),
                    links: JSON.stringify(next.links),
                    media: JSON.stringify(next.media),
                    draftedAt:
                        next.status === "draft" && item.draftedAt === null
                            ? this.clock.now().toISOString()
                            : item.draftedAt,
                    evidence: JSON.stringify(evidence),
                })
                .returning("*")
                .execute()
            const row = contentItemOfRaw(saved.raw)
            if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
            return toContentItem(row)
        })
    }

    /** Calendar drag respects the publication lock. */
    move(userId: string, workspaceId: string, id: string, scheduledAt: string): Promise<ContentItem> {
        return this.save(userId, workspaceId, id, { scheduledAt })
    }

    /** Skips, restores, reopens or deletes only from a permitted state. */
    async transition(userId: string, workspaceId: string, id: string, kind: string): Promise<ContentItemReference> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        return this.entityManager.transaction(async (tx) => {
            const item = await this.lock(tx, workspaceId, id)
            if (kind === "delete") {
                if (!["idea", "draft", "skipped"].includes(item.status))
                    throw new ContentItemsError({ code: ContentItemsErrorCode.WrongStatus })
                await tx.delete(ContentItemEntity, { workspaceId, id, status: In(["idea", "draft", "skipped"]) })
            } else {
                const status = contentTransition(item, kind)
                const evidence = [
                    ...item.evidence,
                    { at: this.clock.now().toISOString(), kind, by: member.displayName, text: kind },
                ].slice(-60)
                await tx
                    .createQueryBuilder(ContentItemEntity, "ci")
                    .update()
                    .set({
                        status,
                        evidence: () => ":evidence::jsonb",
                        ...(kind === "reopen" ? { approvedBy: null, approvedAt: null } : {}),
                    })
                    .where({ workspaceId, id })
                    .setParameter("evidence", JSON.stringify(evidence))
                    .execute()
            }
            return { id }
        })
    }

    /** Dashboard counts use the live clock and the Vietnam calendar month. */
    async figures(userId: string, workspaceId: string): Promise<ContentFigures> {
        await this.members.require(userId, workspaceId)
        const now = this.clock.now()
        const shifted = new Date(now.getTime() + OFFSET_MS)
        const boundary = (month: number): Date => new Date(Date.UTC(shifted.getUTCFullYear(), month, 1) - OFFSET_MS)
        const [from, to] = [boundary(shifted.getUTCMonth()), boundary(shifted.getUTCMonth() + 1)]
        const manager = this.entityManager
        const [awaitingApproval, published30, covered, total, upcoming] = await Promise.all([
            manager.count(ContentItemEntity, { where: { workspaceId, status: "waiting_approval" } }),
            manager.count(ContentItemEntity, {
                where: {
                    workspaceId,
                    status: "published",
                    publishedAt: MoreThanOrEqual(new Date(now.getTime() - 30 * DAY_MS)),
                },
            }),
            this.coveredPillars(workspaceId, from, to),
            this.pillars.countActive(workspaceId),
            manager.findOne(ContentItemEntity, {
                where: { workspaceId, status: "approved", scheduledAt: MoreThanOrEqual(now) },
                order: { scheduledAt: "ASC" },
            }),
        ])
        return {
            awaitingApproval,
            published30,
            next: upcoming?.scheduledAt ? { at: contentInstant(upcoming.scheduledAt), title: upcoming.title } : null,
            pillars: { covered, total },
        }
    }

    /** Core page data with authorization proved before reading the latest plan. */
    async workbench(userId: string, workspaceId: string, readPlan: PlanReader): Promise<ContentWorkbench> {
        const actor = await this.actor(userId, workspaceId)
        const [items, figures, plan] = await Promise.all([
            this.list(userId, workspaceId),
            this.figures(userId, workspaceId),
            readPlan(workspaceId),
        ])
        return {
            nowIso: this.clock.now().toISOString(),
            workspaceId,
            canManage: actor.canManage,
            actor,
            items,
            figures,
            lastPlan:
                plan === undefined
                    ? null
                    : { month: plan.month, ideas: plan.ideas, ms: plan.ms, createdAt: contentInstant(plan.createdAt) },
        }
    }

    /** Checks completed video attachments through the capability that owns the render rows. */
    private async requireMedia(workspaceId: string, media: ReadonlyArray<ContentMediaRef>): Promise<void> {
        const ids = media.flatMap((attachment) =>
            attachment.kind === "video_render" && attachment.id !== undefined ? [attachment.id] : [],
        )
        if (ids.length === 0) return
        const found = await this.renders.findCompletedMedia(workspaceId, ids)
        requireContentInput(found.length === new Set(ids).size)
    }
    private validateDate(value: string | null | undefined): void {
        requireContentInput(value === undefined || value === null || !Number.isNaN(Date.parse(value)))
    }

    private validateRange(range: ContentRange): void {
        this.validateDate(range.from)
        this.validateDate(range.to)
        requireContentInput(
            range.from === undefined || range.to === undefined || Date.parse(range.from) < Date.parse(range.to),
        )
    }

    private async lock(tx: EntityManager, workspaceId: string, id: string): Promise<ContentItem> {
        const row = await tx.findOne(ContentItemEntity, {
            where: { workspaceId, id },
            lock: { mode: "pessimistic_write" },
        })
        if (row === null) throw new ContentItemsError({ code: ContentItemsErrorCode.NotFound })
        return toContentItem(row)
    }

    /** How many active themes have a post scheduled in the window (a skipped post does not count). */
    private async coveredPillars(workspaceId: string, from: Date, to: Date): Promise<number> {
        const scheduled = await this.entityManager
            .createQueryBuilder(ContentItemEntity, "i")
            .select("i.pillar_id", "pillarId")
            .distinct(true)
            .where("i.workspace_id = :workspaceId AND i.status <> 'skipped' AND i.pillar_id IS NOT NULL", {
                workspaceId,
            })
            .andWhere("i.scheduled_at >= :from AND i.scheduled_at < :to", { from, to })
            .limit(PILLARS_MAX)
            .getRawMany<{ pillarId: string }>()
        return this.pillars.countActiveAmong(
            workspaceId,
            scheduled.map((row) => row.pillarId),
        )
    }

    private async requirePillar(tx: EntityManager, workspaceId: string, id: string | null): Promise<void> {
        if (id === null) return
        requireContentInput(await this.pillars.exists(workspaceId, id, tx))
    }
}
