import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { QuotaLookup, UsageSummary } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { AiWorkUsageService, WORK_REF_LIMIT } from "./ai-work-usage.service"
import { documentCostOf, workCostOf } from "./work-usage.mapper"
import type { DocumentAiCost, WorkCost } from "./work-usage.contracts"

/** The roles that see what AI work cost (owner: "model, so credits" for the owner and managers; staff never). */
const SEES_CREDITS: ReadonlySet<string> = new Set(["owner", "manager"])

/** The ids in pages the record read takes at once. */
const pagesOf = (ids: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> =>
    Array.from({ length: Math.ceil(ids.length / WORK_REF_LIMIT) }, (_, index) =>
        ids.slice(index * WORK_REF_LIMIT, (index + 1) * WORK_REF_LIMIT),
    )

@Injectable()
/** Member-scoped usage reads for the credits page, the manager's billing card and the cost of each piece of AI work. */
export class AiUsageOverviewService {
    constructor(
        private readonly usage: AiUsageEventsService,
        private readonly members: WorkspaceMembersService,
        private readonly work: AiWorkUsageService,
    ) {}

    /** Current-month quota for any active member; database failures surface to the browser. */
    async quotaStatus(userId: string, workspaceId: string): Promise<QuotaLookup> {
        await this.members.require(userId, workspaceId)
        return this.usage.readQuotaStatus(workspaceId)
    }

    /** The quota, module split and daily series for an active owner or manager. */
    async usageSummary(userId: string, workspaceId: string): Promise<UsageSummary> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        return this.usage.usageSummary(workspaceId)
    }

    /** The non-guide model cost from a selected day for any active member. */
    async recentCostUsd(userId: string, workspaceId: string, from: string): Promise<number> {
        await this.members.require(userId, workspaceId)
        return this.usage.recentCostUsd(workspaceId, from)
    }

    /**
     * What each document cost to read, critique and re-read, for an owner or manager; null for any other member of the workspace (the
     * documents list is open to every member, its credits are not). A non-member is refused. One grouped read per 100 documents.
     */
    async documentCosts(
        userId: string,
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, DocumentAiCost> | null> {
        if (!(await this.seesCredits(userId, workspaceId))) return null
        const costs = new Map<string, DocumentAiCost>()
        const reads = await Promise.all(
            pagesOf([...new Set(sourceIds)]).map(async (page) => ({
                page,
                usage: await this.work.byRefs(
                    workspaceId,
                    page.map((id) => `source:${id}`),
                ),
            })),
        )
        for (const { page, usage } of reads) {
            for (const id of page) costs.set(id, documentCostOf(usage.get(`source:${id}`) ?? []))
        }
        return costs
    }

    /**
     * What a learning proposal cost to produce: the calls booked to its lessons (`lesson:<candidate id>`: the judgement of each answer
     * and the draft), exact; null for a member who is not an owner or manager. Read within the caller's own role check, once per card.
     */
    async lessonsCost(userId: string, workspaceId: string, lessonIds: ReadonlyArray<string>): Promise<WorkCost | null> {
        if (!(await this.seesCredits(userId, workspaceId))) return null
        return this.lessonsCostOf(workspaceId, lessonIds)
    }

    /** The cost of the lessons given, for a caller that proved the role itself (the card read of the room). */
    async lessonsCostOf(workspaceId: string, lessonIds: ReadonlyArray<string>): Promise<WorkCost> {
        const refs = [...new Set(lessonIds)].slice(0, WORK_REF_LIMIT).map((id) => `lesson:${id}`)
        const usage = await this.work.byRefs(workspaceId, refs)
        return workCostOf(refs.flatMap((ref) => usage.get(ref) ?? []))
    }

    /** True for an active owner or manager; false for another active member; a non-member is refused. */
    private async seesCredits(userId: string, workspaceId: string): Promise<boolean> {
        const member = await this.members.require(userId, workspaceId)
        return SEES_CREDITS.has(member.role)
    }
}
