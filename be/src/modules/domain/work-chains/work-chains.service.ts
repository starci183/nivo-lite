import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { WorkThreadEntity } from "@modules/domain/work-threads"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { toChainStep } from "./chain-step.mapper"
import { judgeStep } from "./chain-limits.policy"
import { summarize } from "./chain-summary.policy"
import { WorkChainsError, WorkChainsErrorCode } from "./errors/work-chains.error"
import type {
    ApprovalStepOutcome,
    ChainActor,
    ChainStep,
    ChainStepRecord,
    ChainStepStatus,
    ChainView,
    MentionRef,
    NewChainStep,
    RecordedStep,
} from "./work-chains.contracts"
import { MAX_AUTOMATIC_STEPS } from "./work-chains.contracts"
import { InjectChainOwnerDirectory } from "./work-chains.decorators"
import type { ChainOwnerDirectory } from "./work-chains.port"
import { WorkChainEntity } from "./persistence/entities"
import { readStepById, selectStepsWithActor } from "./persistence/work-chain.query"

/** The most steps one chain read answers. */
const CHAIN_STEPS_MAX = 500

/** The most members one owner lookup checks. */
const OWNER_CANDIDATES_MAX = 10

/** A step that tags a group is information, not a request one person answers: it ends as it begins. */
const initialStatusOf = (step: NewChainStep): ChainStepStatus => {
    if (step.kind === "ask_approval") return "waiting"
    if (step.kind === "self" || step.target === null || step.target.kind === "group") return "done"
    return "waiting"
}

@Injectable()
/** The chain of a work thread: the only writer of work_chains. Every step is also written into the evidence log. */
export class WorkChainsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectChainOwnerDirectory() private readonly owners: ChainOwnerDirectory,
        private readonly events: EventsService,
    ) {}

    /**
     * Records one more step of the thread's chain. An agent step that would pass the automatic limit, or repeat what the same
     * agent pair already did, is stored as a stopped hand-off to the agent's owner instead, and the answer says so.
     */
    record(step: NewChainStep, manager?: EntityManager): Promise<RecordedStep> {
        const run = (tx: EntityManager): Promise<RecordedStep> => this.recordIn(tx, step)
        return manager === undefined ? this.entityManager.transaction(run) : run(manager)
    }

    /** The steps of the thread's chain in order, with their summary. */
    async view(workspaceId: string, threadId: string): Promise<ChainView> {
        const rows = await this.stepsOf(this.entityManager, workspaceId, threadId)
        const steps = rows.map(toChainStep)
        return { steps, summary: summarize(steps, this.clock.now()) }
    }

    /** The hand-offs and assignments that waited on this member or agent are done: they answered. */
    async settleFor(
        workspaceId: string,
        threadId: string,
        actor: ChainActor,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager
            .createQueryBuilder(WorkChainEntity, "w")
            .update()
            .set({
                status: "done",
                finishedAt: () => "now()",
                ...(actor.kind === "member" ? { decidedBy: actor.id } : {}),
            })
            .where(
                "workspace_id = :workspaceId AND thread_id = :threadId AND status = 'waiting' AND kind IN ('hand_off', 'assign') " +
                    "AND target ->> 'kind' = :actorKind AND target ->> 'id' = :actorId",
                { workspaceId, threadId, actorKind: actor.kind, actorId: actor.id },
            )
            .execute()
    }

    /** Settles the approval step of a request: approved is done, the others end as they are, and the evidence log says who. */
    settleApproval(outcome: ApprovalStepOutcome, manager?: EntityManager): Promise<void> {
        const run = (tx: EntityManager): Promise<void> => this.settleApprovalIn(tx, outcome)
        return manager === undefined ? this.entityManager.transaction(run) : run(manager)
    }

    private async settleApprovalIn(manager: EntityManager, outcome: ApprovalStepOutcome): Promise<void> {
        const status: ChainStepStatus = outcome.outcome === "approved" ? "done" : outcome.outcome
        const changed = await manager
            .createQueryBuilder(WorkChainEntity, "w")
            .update()
            .set({ status, decidedBy: outcome.decidedBy, finishedAt: () => "now()" })
            .where(
                "workspace_id = :workspaceId AND approval_request_id = :requestId AND kind = 'ask_approval' AND status = 'waiting'",
                { workspaceId: outcome.workspaceId, requestId: outcome.approvalRequestId },
            )
            .returning("thread_id, action")
            .execute()
        const [settled] = changed.raw as Array<{ thread_id: string; action: string }>
        if (settled === undefined) return
        const thread = await manager.findOne(WorkThreadEntity, {
            select: { id: true, leadId: true },
            where: { id: settled.thread_id },
        })
        const decider =
            outcome.decidedBy === null ? "" : await this.memberNameOf(manager, outcome.workspaceId, outcome.decidedBy)
        await this.events.record(
            {
                workspaceId: outcome.workspaceId,
                kind: "work_chain.approval",
                actor: decider,
                summary: this.catalog.get(
                    `chain.approval.${outcome.outcome}`,
                    { name: decider, action: settled.action },
                    outcome.locale,
                ),
                leadId: thread?.leadId ?? null,
            },
            manager,
        )
    }

    /** Ties the approval step to the request the gate opened for it. */
    async linkApproval(
        workspaceId: string,
        stepId: string,
        requestId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.update(
            WorkChainEntity,
            { workspaceId, id: stepId, kind: "ask_approval", status: "waiting" },
            { approvalRequestId: requestId },
        )
    }

    /** Ends a waiting step as stopped when the request it waited for could not be opened. */
    async abandon(workspaceId: string, stepId: string): Promise<void> {
        await this.entityManager.update(
            WorkChainEntity,
            { workspaceId, id: stepId, status: "waiting" },
            { status: "stopped", finishedAt: () => "now()" },
        )
    }

    /** The member to tag when an agent's work comes back to its owner: the owner, else the fallback, else the workspace owner. */
    async ownerTagOf(
        workspaceId: string,
        agentId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<MentionRef> {
        const owner = await this.owners.ownerOf(agentId)
        const active = await manager
            .createQueryBuilder()
            .select("m.id", "id")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.status = 'active' AND m.id = ANY(:memberIds)", {
                workspaceId,
                memberIds: [owner.ownerMemberId, owner.fallbackMemberId],
            })
            .limit(OWNER_CANDIDATES_MAX)
            .getRawMany<{ id: string }>()
        const present = new Set(active.map((row) => row.id))
        const chosen = [owner.ownerMemberId, owner.fallbackMemberId].find((id) => present.has(id))
        if (chosen !== undefined) return { kind: "member", id: chosen }
        const workspace = await manager
            .createQueryBuilder()
            .select("m.id", "id")
            .from("public.workspace_members", "m")
            .innerJoin("workspaces", "w", "w.id = m.workspace_id AND w.owner_id = m.user_id")
            .where("m.workspace_id = :workspaceId", { workspaceId })
            .limit(1)
            .getRawOne<{ id: string }>()
        return { kind: "member", id: workspace?.id ?? owner.fallbackMemberId }
    }

    private async recordIn(tx: EntityManager, step: NewChainStep): Promise<RecordedStep> {
        const thread = await tx.findOne(WorkThreadEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId: step.workspaceId, id: step.threadId },
            lock: { mode: "pessimistic_write" },
        })
        if (thread === null) throw new WorkChainsError({ code: WorkChainsErrorCode.ThreadNotFound })
        const history = (await this.stepsOf(tx, step.workspaceId, step.threadId)).map(toChainStep)
        const verdict = judgeStep(history, step)
        if (verdict.kind === "continue") {
            const stored = await this.store(tx, step, initialStatusOf(step), thread.leadId)
            return { step: stored, verdict: "continue", stopReason: null, ownerTag: null }
        }
        const ownerTag = await this.ownerTagOf(step.workspaceId, step.actor.id, tx)
        const detail = this.catalog.get(`chain.stopped.${verdict.reason}`, { max: MAX_AUTOMATIC_STEPS }, step.locale)
        const stored = await this.store(
            tx,
            { ...step, kind: "hand_off", target: ownerTag, detail, approvalRequestId: null },
            "stopped",
            thread.leadId,
        )
        return { step: stored, verdict: "stopped", stopReason: verdict.reason, ownerTag }
    }

    private async store(
        tx: EntityManager,
        step: NewChainStep,
        status: ChainStepStatus,
        leadId: string | null,
    ): Promise<ChainStep> {
        const result = await tx
            .createQueryBuilder(WorkChainEntity, "w")
            .insert()
            .values({
                workspaceId: step.workspaceId,
                threadId: step.threadId,
                seq: () => "(SELECT coalesce(max(seq), 0) + 1 FROM public.work_chains WHERE thread_id = :seqThreadId)",
                actorKind: step.actor.kind,
                actorId: step.actor.id,
                kind: step.kind,
                action: step.action,
                detail: step.detail,
                rule: step.rule,
                target: step.target,
                approvalRequestId: step.approvalRequestId,
                status,
                // A step that waits has no end yet, any other ends now.
                finishedAt: status === "waiting" ? null : () => "now()",
            })
            .setParameter("seqThreadId", step.threadId)
            .returning("id")
            .execute()
        const [inserted] = result.raw as Array<{ id: string }>
        if (inserted === undefined) throw new WorkChainsError({ code: WorkChainsErrorCode.NotStored })
        const row = await readStepById(tx, step.workspaceId, inserted.id)
        if (row === undefined) throw new WorkChainsError({ code: WorkChainsErrorCode.NotStored })
        const stored = toChainStep(row)
        await this.events.record(
            {
                workspaceId: step.workspaceId,
                kind: "work_chain.step",
                actor: stored.actorName,
                summary: stored.action,
                leadId,
                evidence: stored.detail === "" ? null : stored.detail,
            },
            tx,
        )
        return stored
    }

    private async memberNameOf(manager: EntityManager, workspaceId: string, id: string): Promise<string> {
        const row = await manager
            .createQueryBuilder()
            .select("x.display_name", "name")
            .from("public.workspace_members", "x")
            .where("x.workspace_id = :workspaceId AND x.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<{ name: string }>()
        return row?.name ?? ""
    }

    private stepsOf(manager: EntityManager, workspaceId: string, threadId: string): Promise<Array<ChainStepRecord>> {
        return selectStepsWithActor(manager, workspaceId)
            .andWhere("s.thread_id = :threadId", { threadId })
            .orderBy("s.seq", "ASC")
            .limit(CHAIN_STEPS_MAX)
            .getRawMany<ChainStepRecord>()
    }
}
