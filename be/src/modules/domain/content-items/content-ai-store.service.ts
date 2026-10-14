import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
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
import type { ContentQuickIdeaRow } from "./persistence/content-ai-store.rows"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import {
    APPLY_GENERATED_DRAFT,
    DELETE_UNTOUCHED_PLAN_IDEAS,
    INSERT_PLANNED_IDEAS,
    INSERT_QUICK_IDEA,
    SELECT_RECENT_CONTENT_TITLES,
} from "./persistence/content-ai-store.sql"

@Injectable()
/** The content-items owner's writes used by queued AI completion. */
export class ContentAiStoreService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
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
        const [row] = await (tx ?? this.entityManager).query<Array<ContentQuickIdeaRow>>(INSERT_QUICK_IDEA, [
            workspaceId,
            input.topic.split("\n", 1).join("").slice(0, 80),
            input.topic,
            [...input.channels],
            member.displayName || userId,
        ])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return { id: row.id, updatedAt: new Date(row.updated_at).toISOString() }
    }

    /** Applies a completed draft only while its item is editable. */
    async applyDraft(
        workspaceId: string,
        itemId: string,
        draft: ContentGeneratedDraft,
        tx?: EntityManager,
    ): Promise<ContentAiItemRef> {
        const [row] = await (tx ?? this.entityManager).query<Array<{ id: string }>>(APPLY_GENERATED_DRAFT, [
            itemId,
            workspaceId,
            JSON.stringify(draft.variants),
            [...draft.hashtags],
            draft.media === undefined ? null : JSON.stringify(draft.media),
            draft.channels === undefined ? null : [...draft.channels],
            draft.pillarId ?? null,
            draft.title ?? null,
            draft.draftedAt ?? null,
            JSON.stringify(draft.evidence ?? []),
            draft.expectedUpdatedAt ?? null,
        ])
        if (row === undefined) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return row
    }

    /** Titles offered to the draft prompt. */
    async recentTitles(workspaceId: string, exceptId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<{ title: string }>>(SELECT_RECENT_CONTENT_TITLES, [
            workspaceId,
            exceptId,
        ])
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
        await manager.query(DELETE_UNTOUCHED_PLAN_IDEAS, [workspaceId, month])
        const ideas = await manager.query<Array<{ id: string }>>(INSERT_PLANNED_IDEAS, [
            workspaceId,
            planId,
            JSON.stringify(
                plan.items.map((item) => ({
                    title: item.title,
                    brief: item.brief,
                    pillar_id: item.pillarId,
                    channels: item.channels,
                    scheduled_at: item.scheduledAt,
                    holiday_key: item.holidayKey,
                })),
            ),
            plan.actor,
            JSON.stringify([{ at: this.clock.now().toISOString(), kind: "planned", by: "NIVO", text: plan.month }]),
        ])
        if (ideas.length !== plan.items.length) throw new ContentItemsError({ code: ContentItemsErrorCode.NotWritten })
        return ideas.length
    }
}
