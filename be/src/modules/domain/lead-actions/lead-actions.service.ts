import { Injectable } from "@nestjs/common"
import { Brackets, In } from "typeorm"
import type { EntityManager } from "typeorm"
import type { WorkContext } from "@modules/domain/decisions"
import { LeadRecordsService } from "@modules/domain/leads"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectErrorsService, isDomainError } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import { InjectRequestLocale } from "@modules/platform/i18n"
import type { RequestLocale } from "@modules/platform/i18n"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { QueueDelivery } from "@modules/platform/queue"
import { LeadActionsQueue, isLeadActionPayload } from "@modules/queues/lead-actions"
import { LeadActionAiService } from "./lead-action-ai.service"
import { LeadActionFlowService } from "./lead-action-flow.service"
import { LeadActionsError, LeadActionsErrorCode } from "./errors/lead-actions.error"
import type {
    LeadAction,
    LeadActionInput,
    LeadActionLanguage,
    LeadActionQueued,
    LeadActionResult,
    LeadActionRun,
    LeadActionStatus,
} from "./lead-actions.contracts"
import { inputOf } from "./lead-action-input.policy"
import { LeadActionEntity } from "./persistence/entities"
import { NOW, returnedRows, runOfRaw } from "./persistence/lead-action-projection"

@Injectable()
/** Owns backend run rows: membership-proved enqueue, workspace-scoped status and results under the platform-held fence. */
export class LeadActionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectRequestLocale() private readonly locale: RequestLocale,
        @InjectErrorsService() private readonly errors: ErrorsService,
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadRecordsService,
        private readonly responsibilities: ResponsibilityJournalService,
        private readonly queue: LeadActionsQueue,
        private readonly ai: LeadActionAiService,
        private readonly flow: LeadActionFlowService,
    ) {}

    /** Enqueues a validated action and its progress row together after proving the member and workspace target. */
    async request(
        userId: string,
        workspaceId: string,
        action: LeadAction,
        input: LeadActionInput,
        acceptLanguage: LeadActionLanguage,
    ): Promise<LeadActionQueued> {
        await this.members.require(userId, workspaceId)
        const normalized = unwrapOutcome(inputOf(action, input), LeadActionsError)
        await this.requireTarget(workspaceId, action, normalized)
        return this.entityManager.transaction(async (manager) => {
            const inserted = await manager.insert(LeadActionEntity, {
                workspaceId,
                requestedBy: userId,
                action,
                input: normalized,
                locale: this.locale.of(acceptLanguage),
            })
            const [run] = inserted.identifiers
            if (typeof run?.id !== "string") throw new LeadActionsError({ code: LeadActionsErrorCode.NotFound })
            await this.queue.enqueue({ workspaceId, runId: run.id }, manager)
            return { id: run.id, status: "queued" }
        })
    }

    /** Returns progress only after proving membership of the selected workspace. */
    async status(userId: string, workspaceId: string, id: string): Promise<LeadActionStatus> {
        await this.members.require(userId, workspaceId)
        const run = await this.entityManager.findOne(LeadActionEntity, {
            select: { id: true, status: true, result: true, errorCode: true },
            where: { workspaceId, id },
        })
        if (run === null) throw new LeadActionsError({ code: LeadActionsErrorCode.NotFound })
        return { id: run.id, status: run.status, result: run.result, errorCode: run.errorCode }
    }

    /** Runs the stored input as its requester; the calling step holds the job fence for this entire operation. */
    async run(job: ClaimedJob): Promise<void> {
        if (!isLeadActionPayload(job.payload)) return
        const payload = job.payload
        const begun = await this.entityManager
            .createQueryBuilder(LeadActionEntity, "la")
            .update()
            .set({ status: "running", jobId: job.jobId, fencingToken: job.fencingToken, updatedAt: NOW })
            .where({ workspaceId: payload.workspaceId, id: payload.runId, status: In(["queued", "running"]) })
            .returning("id, workspace_id, requested_by, action, input, locale, status, result, error_code")
            .execute()
        const run = runOfRaw(begun.raw)
        if (run === undefined) return
        const write = { id: run.id, workspaceId: run.workspaceId, jobId: job.jobId, fencingToken: job.fencingToken }
        try {
            const member = await this.members.require(run.requestedBy, run.workspaceId)
            const stored = { ...run, input: unwrapOutcome(inputOf(run.action, run.input), LeadActionsError) }
            const ctx = { workspaceId: run.workspaceId, actor: member.displayName, locale: run.locale }
            const result = await this.execute(ctx, stored)
            this.requireOwned(await this.finish(write, { status: "succeeded", result, errorCode: null }))
        } catch (cause) {
            if (!isDomainError(cause)) throw cause
            const kind = this.errors.describe(cause).kind
            const workFailed = cause instanceof LeadActionsError && cause.code === LeadActionsErrorCode.WorkFailed
            if (!workFailed && (kind === "unavailable" || kind === "internal" || kind === "rate-limited")) throw cause
            this.requireOwned(await this.finish(write, { status: "failed", errorCode: cause.code }))
        }
    }

    /** Records exhaustion only while the platform proves the matching failed claim has no live successor. */
    async failDelivery(delivery: QueueDelivery, cause: unknown): Promise<void> {
        if (!isLeadActionPayload(delivery.payload)) return
        const payload = delivery.payload
        const code = isDomainError(cause) ? cause.code : LeadActionsErrorCode.WorkFailed
        await this.claims.withFailedFence(delivery.id, async (fence) => {
            await this.entityManager
                .createQueryBuilder(LeadActionEntity, "la")
                .update()
                .set({ status: "failed", errorCode: code, updatedAt: NOW })
                .where({ workspaceId: payload.workspaceId, id: payload.runId, status: In(["queued", "running"]) })
                .andWhere(
                    new Brackets((held) =>
                        held.where("job_id IS NULL").orWhere("job_id = :jobId AND fencing_token = :fencingToken", {
                            jobId: fence.jobId,
                            fencingToken: fence.expectedFencingToken,
                        }),
                    ),
                )
                .execute()
        })
    }

    private execute(ctx: WorkContext, run: LeadActionRun): Promise<LeadActionResult> {
        switch (run.action) {
            case "create":
                return this.flow.create(ctx, run)
            case "refresh-context":
                return this.ai.refreshContext(ctx, run.input.leadId ?? "")
            case "suggest-owner":
                return this.ai.suggestOwner(ctx, run.requestedBy, run.input.leadId ?? "")
            case "draft-execution":
                return this.flow.draft(ctx, run)
            case "settle-won":
                return this.flow.settleWon(ctx, run)
        }
    }

    /** Writes the terminal state of a run only for the worker whose fence the platform still holds; answers the rows written. */
    private async finish(
        held: {
            readonly id: string
            readonly workspaceId: string
            readonly jobId: string
            readonly fencingToken: number
        },
        change: Partial<Pick<LeadActionEntity, "status" | "result" | "errorCode">>,
    ): Promise<ReadonlyArray<object>> {
        const written = await this.entityManager
            .createQueryBuilder(LeadActionEntity, "la")
            .update()
            .set({ ...change, updatedAt: NOW })
            .where({
                id: held.id,
                workspaceId: held.workspaceId,
                jobId: held.jobId,
                fencingToken: held.fencingToken,
                status: "running",
            })
            .returning("id")
            .execute()
        return returnedRows(written.raw)
    }

    private requireOwned(rows: ReadonlyArray<object>): void {
        if (rows.length === 0) throw new LeadActionsError({ code: LeadActionsErrorCode.NotFound })
    }

    private async requireTarget(workspaceId: string, action: LeadAction, input: LeadActionInput): Promise<void> {
        if (action === "create") return
        if (action === "draft-execution") {
            const target = await this.responsibilities.find(workspaceId, input.responsibilityId ?? "")
            if (target === null) throw new LeadActionsError({ code: LeadActionsErrorCode.NotFound })
            return
        }
        const lead = await this.leads.require(workspaceId, input.leadId ?? "")
        if (action === "settle-won" && lead.stage !== "won")
            throw new LeadActionsError({ code: LeadActionsErrorCode.NotWon })
    }
}
