import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    ContentAiItemRef,
    ContentQuickIdeaCreated,
    ContentQuickIdeaInput,
    ContentGeneratedDraft,
    ContentGeneratedPlan,
} from "./content-ai-store.contracts"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import { returnedRows } from "./persistence/content-item.projection"
import { ContentItemEntity } from "./persistence/entities"

/** The revision the caller read is still the stored one, or the caller named none. */
const REVISION_UNCHANGED =
    "(:expected::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = :expected::timestamptz)"

@Injectable()
/** The content-items owner's writes used by queued AI completion. */
export class ContentAiStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly pillars: ContentPillarsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Creates a quick idea in the transaction that queues its first draft. */
    async createQuickIdea(
        userId: string,
        workspaceId: string,
        input: ContentQuickIdeaInput,
        tx?: EntityManager,
    ): Promise<ContentQuickIdeaCreated> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        const inserted = await (tx ?? this.entityManager)
            .createQueryBuilder(ContentItemEntity, "ci")
            .insert()
            .values({
                workspaceId,
                title: (input.topic.split("\n")[0] ?? input.topic).slice(0, 80),
                brief: input.topic,
                channels: [...input.channels],
                status: "idea",
                source: "quick",
                createdBy: member.displayName || userId,
            })
            .returning("id, updated_at")
            .execute()
        const [row] = returnedRows(inserted.raw)
        const id: unknown = row === undefined ? undefined : Reflect.get(row, "id")
        const updatedAt: unknown = row === undefined ? undefined : Reflect.get(row, "updated_at")
        if (typeof id !== "string" || !(typeof updatedAt === "string" || updatedAt instanceof Date)) {
            throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        }
        return { id, updatedAt: new Date(updatedAt).toISOString() }
    }

    /** Applies a completed draft only while its item is editable. */
    async applyDraft(
        workspaceId: string,
        itemId: string,
        draft: ContentGeneratedDraft,
        tx?: EntityManager,
    ): Promise<ContentAiItemRef> {
        const manager = tx ?? this.entityManager
        // A pillar of another workspace (or none) refuses the draft the way a row that is no longer editable does.
        if (draft.pillarId !== undefined && !(await this.pillars.exists(workspaceId, draft.pillarId, manager))) {
            throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        }
        const updated = await manager
            .createQueryBuilder(ContentItemEntity, "ci")
            .update()
            .set({
                variants: () => ":variants::jsonb",
                hashtags: [...draft.hashtags],
                media: () => "coalesce(:media::jsonb, media)",
                channels: () => "coalesce(:channels::text[], channels)",
                pillarId: () => "coalesce(:pillarId::uuid, pillar_id)",
                title: () => "coalesce(:title::text, title)",
                draftedAt: () => "coalesce(:draftedAt::timestamptz, now())",
                status: "draft",
                evidence: () => "jsonb_concat(evidence, CAST(:evidence AS jsonb))",
            })
            .where("id = :itemId AND workspace_id = :workspaceId AND status IN ('idea', 'draft')", {
                itemId,
                workspaceId,
            })
            .andWhere(REVISION_UNCHANGED)
            .setParameters({
                variants: JSON.stringify(draft.variants),
                media: draft.media === undefined ? null : JSON.stringify(draft.media),
                channels: draft.channels === undefined ? null : [...draft.channels],
                pillarId: draft.pillarId ?? null,
                title: draft.title ?? null,
                draftedAt: draft.draftedAt ?? null,
                evidence: JSON.stringify(draft.evidence ?? []),
                expected: draft.expectedUpdatedAt ?? null,
            })
            .returning("id")
            .execute()
        const [row] = returnedRows(updated.raw)
        const id: unknown = row === undefined ? undefined : Reflect.get(row, "id")
        if (typeof id !== "string") throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return { id }
    }

    /** Titles offered to the draft prompt. */
    async recentTitles(workspaceId: string, exceptId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(ContentItemEntity, {
            where: { workspaceId, id: Not(exceptId) },
            select: { title: true },
            order: { createdAt: "DESC" },
            take: 8,
        })
        return rows.map((row) => row.title)
    }

    /** Replaces the items of a plan whose owner has already serialized and inserted the plan. */
    async insertPlannedIdeas(
        workspaceId: string,
        planId: string,
        plan: ContentGeneratedPlan,
        manager: EntityManager,
    ): Promise<number> {
        const month = `${plan.month.slice(0, 7)}-01`
        await manager
            .createQueryBuilder(ContentItemEntity, "ci")
            .delete()
            .where({ workspaceId, status: "idea", source: "plan" })
            .andWhere("scheduled_at >= (:month::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')", { month })
            .andWhere("scheduled_at < ((:month::date + interval '1 month')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')")
            .execute()
        const known = await this.pillars.known(
            workspaceId,
            plan.items.map((item) => item.pillarId),
            manager,
        )
        const placeable = plan.items.filter((item) => known.includes(item.pillarId))
        const history = [{ at: this.clock.now().toISOString(), kind: "planned", by: "NIVO", text: plan.month }] as const
        const ideas =
            placeable.length === 0
                ? []
                : returnedRows(
                      (
                          await manager
                              .createQueryBuilder(ContentItemEntity, "ci")
                              .insert()
                              .values(
                                  placeable.map((item) => ({
                                      workspaceId,
                                      planId,
                                      title: item.title,
                                      brief: item.brief,
                                      pillarId: item.pillarId,
                                      channels: [...item.channels],
                                      scheduledAt: new Date(item.scheduledAt),
                                      holidayKey: item.holidayKey,
                                      status: "idea",
                                      source: "plan",
                                      createdBy: plan.actor,
                                      evidence: [...history],
                                  })),
                              )
                              .returning("id")
                              .execute()
                      ).raw,
                  )
        if (ideas.length !== plan.items.length) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return ideas.length
    }
}
