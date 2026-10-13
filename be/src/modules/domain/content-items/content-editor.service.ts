import { VideoRendersService } from "@modules/domain/video-renders"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
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
} from "./content-editor.contracts"
import type {
    ContentEditorIdRow,
    ContentEditorRow,
    ContentFiguresRow,
    ContentPlanSummaryRow,
} from "./persistence/content-editor.rows"
import { contentInstant, toContentItem } from "./content-editor.mapper"
import { contentChannels, contentTransition, mergeContentPatch, requireContentInput } from "./content-editor.policy"
import {
    CONTENT_FIGURES,
    CREATE_CONTENT_ITEM,
    DELETE_CONTENT_ITEM,
    FIND_CONTENT_ITEM,
    FIND_CONTENT_PILLAR,
    LAST_CONTENT_PLAN,
    LIST_CONTENT_ITEMS,
    LOCK_CONTENT_ITEM,
    NEXT_CONTENT_ITEM,
    SAVE_CONTENT_ITEM,
    TRANSITION_CONTENT_ITEM,
} from "./persistence/content-editor.sql"

const OFFSET_MS = 7 * 3_600_000

@Injectable()
/** Content reads and editor writes over the existing content tables, with the caller's membership proved on every public operation. */
export class ContentEditorService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
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
        const rows = await this.entityManager.query<Array<ContentEditorRow>>(LIST_CONTENT_ITEMS, [
            workspaceId,
            range.from ?? null,
            range.to ?? null,
        ])
        return rows.map(toContentItem)
    }

    /** A workspace-scoped row for trusted application orchestration. */
    async get(workspaceId: string, id: string): Promise<ContentItem> {
        const [row] = await this.entityManager.query<Array<ContentEditorRow>>(FIND_CONTENT_ITEM, [workspaceId, id])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotFound })
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
        const [row] = await this.entityManager.query<Array<ContentEditorRow>>(CREATE_CONTENT_ITEM, [
            workspaceId,
            input.title.trim().slice(0, 200),
            contentChannels(input.channels),
            input.scheduledAt ?? null,
            input.pillarId ?? null,
            member.displayName,
            JSON.stringify(evidence),
        ])
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
            const [row] = await tx.query<Array<ContentEditorRow>>(SAVE_CONTENT_ITEM, [
                workspaceId,
                id,
                next.title,
                next.brief,
                next.pillarId,
                next.channels,
                next.scheduledAt,
                JSON.stringify(next.variants),
                next.hashtags,
                JSON.stringify(next.links),
                JSON.stringify(next.media),
                next.status,
                next.status === "draft" && item.draftedAt === null ? this.clock.now().toISOString() : item.draftedAt,
                JSON.stringify(evidence),
            ])
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
                await tx.query(DELETE_CONTENT_ITEM, [workspaceId, id])
            } else {
                const status = contentTransition(item, kind)
                const evidence = [
                    ...item.evidence,
                    { at: this.clock.now().toISOString(), kind, by: member.displayName, text: kind },
                ].slice(-60)
                await tx.query(TRANSITION_CONTENT_ITEM, [
                    workspaceId,
                    id,
                    status,
                    JSON.stringify(evidence),
                    kind === "reopen",
                ])
            }
            return { id }
        })
    }

    /** Dashboard counts use the live clock and the Vietnam calendar month. */
    async figures(userId: string, workspaceId: string): Promise<ContentFigures> {
        await this.members.require(userId, workspaceId)
        const now = this.clock.now()
        const shifted = new Date(now.getTime() + OFFSET_MS)
        const boundary = (month: number): string =>
            new Date(Date.UTC(shifted.getUTCFullYear(), month, 1) - OFFSET_MS).toISOString()
        const [counts, upcoming] = await Promise.all([
            this.entityManager.query<Array<ContentFiguresRow>>(CONTENT_FIGURES, [
                workspaceId,
                now.toISOString(),
                boundary(shifted.getUTCMonth()),
                boundary(shifted.getUTCMonth() + 1),
            ]),
            this.entityManager.query<Array<ContentEditorRow>>(NEXT_CONTENT_ITEM, [workspaceId, now.toISOString()]),
        ])
        const row = counts[0]
        const next = upcoming[0]
        return {
            awaitingApproval: row?.awaiting_approval ?? 0,
            published30: row?.published_30 ?? 0,
            next: next?.scheduled_at ? { at: contentInstant(next.scheduled_at), title: next.title } : null,
            pillars: { covered: row?.covered ?? 0, total: row?.total ?? 0 },
        }
    }

    /** Core page data with authorization proved before reading the latest plan. */
    async workbench(userId: string, workspaceId: string): Promise<ContentWorkbench> {
        const actor = await this.actor(userId, workspaceId)
        const [items, figures, plans] = await Promise.all([
            this.list(userId, workspaceId),
            this.figures(userId, workspaceId),
            this.entityManager.query<Array<ContentPlanSummaryRow>>(LAST_CONTENT_PLAN, [workspaceId]),
        ])
        const plan = plans[0]
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
                    : {
                          month: plan.month,
                          ideas: plan.idea_count,
                          ms: plan.ai_ms,
                          createdAt: contentInstant(plan.created_at),
                      },
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
        const [row] = await tx.query<Array<ContentEditorRow>>(LOCK_CONTENT_ITEM, [workspaceId, id])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotFound })
        return toContentItem(row)
    }

    private async requirePillar(tx: EntityManager, workspaceId: string, id: string | null): Promise<void> {
        if (id === null) return
        const rows = await tx.query<Array<ContentEditorIdRow>>(FIND_CONTENT_PILLAR, [workspaceId, id])
        requireContentInput(rows.length === 1)
    }
}
