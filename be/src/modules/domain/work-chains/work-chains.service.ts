import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentCard } from "@modules/domain/agents"
import { WorkThreadsService } from "@modules/domain/work-threads"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { DirectoryMember } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
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
    ChainStepRead,
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
import { readStepById, selectSteps } from "./persistence/work-chain.query"

/** The most steps one chain read answers. */
const CHAIN_STEPS_MAX = 500

/** The most members one owner lookup checks. */
const OWNER_CANDIDATES_MAX = 10

/** The agents and members that acted in some steps, by id. */
interface Actors {
    readonly agents: ReadonlyMap<string, AgentCard>
    readonly members: ReadonlyMap<string, DirectoryMember>
}

/** The step with the name and role of whoever acted: an agent name and module, or a member display name and role; empty when gone. */
const namedBy = (row: ChainStepRead, actors: Actors): ChainStepRecord => {
    const agent = row.actor_kind === "agent" ? actors.agents.get(row.actor_id) : undefined
    const member = row.actor_kind === "member" ? actors.members.get(row.actor_id) : undefined
    return {
        ...row,
        actor_name: agent?.name ?? member?.displayName ?? "",
        actor_role: agent?.module ?? member?.role ?? "",
    }
}

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
        private readonly threads: WorkThreadsService,
        private readonly agents: AgentDirectoryService,
        private readonly members: WorkspaceMemberDirectoryService,
        private readonly workspaces: WorkspacesService,
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
        const thread = await this.threads.findIfAny(outcome.workspaceId, settled.thread_id, manager)
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
        const candidates = [owner.ownerMemberId, owner.fallbackMemberId]
        const active = await this.members.activeAmong(workspaceId, candidates, OWNER_CANDIDATES_MAX, manager)
        const present = new Set(active.map((member) => member.id))
        const chosen = candidates.find((id) => present.has(id))
        if (chosen !== undefined) return { kind: "member", id: chosen }
        const workspaceOwner = await this.workspaces.ownerIdOf(workspaceId)
        const seat = workspaceOwner === null ? null : await this.members.idOfUser(workspaceId, workspaceOwner, manager)
        return { kind: "member", id: seat ?? owner.fallbackMemberId }
    }

    private async recordIn(tx: EntityManager, step: NewChainStep): Promise<RecordedStep> {
        const thread = await this.threads.lockIfAny(tx, step.workspaceId, step.threadId)
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
        const read = await readStepById(tx, step.workspaceId, inserted.id)
        if (read === undefined) throw new WorkChainsError({ code: WorkChainsErrorCode.NotStored })
        const stored = toChainStep(await this.withActor(tx, step.workspaceId, read))
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

    private async memberNameOf(manager: EntityManager, workspaceId: string, memberId: string): Promise<string> {
        return (await this.members.find(workspaceId, memberId, manager))?.displayName ?? ""
    }

    private async stepsOf(
        manager: EntityManager,
        workspaceId: string,
        threadId: string,
    ): Promise<Array<ChainStepRecord>> {
        const rows = await selectSteps(manager, workspaceId)
            .andWhere("s.thread_id = :threadId", { threadId })
            .orderBy("s.seq", "ASC")
            .limit(CHAIN_STEPS_MAX)
            .getRawMany<ChainStepRead>()
        return this.withActors(manager, workspaceId, rows)
    }

    /** The steps with the name and role of whoever acted: an agent name and module, or a member display name and role. */
    private async withActors(
        manager: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ChainStepRead>,
    ): Promise<Array<ChainStepRecord>> {
        const actors = await this.actorsOf(manager, workspaceId, rows)
        return rows.map((row) => namedBy(row, actors))
    }

    /** One step with the name and role of whoever acted. */
    private async withActor(manager: EntityManager, workspaceId: string, row: ChainStepRead): Promise<ChainStepRecord> {
        return namedBy(row, await this.actorsOf(manager, workspaceId, [row]))
    }

    private async actorsOf(
        manager: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ChainStepRead>,
    ): Promise<Actors> {
        const idsOf = (kind: string): Array<string> => [
            ...new Set(rows.filter((row) => row.actor_kind === kind).map((row) => row.actor_id)),
        ]
        const [agents, members] = await Promise.all([
            this.agents.cardsOf(workspaceId, idsOf("agent")),
            this.members.byIds(workspaceId, idsOf("member"), manager),
        ])
        return {
            agents: new Map(agents.map((agent) => [agent.id, agent])),
            members: new Map(members.map((member) => [member.id, member])),
        }
    }
}
