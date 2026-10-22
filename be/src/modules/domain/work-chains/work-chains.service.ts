import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
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
    ChainStepStatus,
    ChainView,
    MentionRef,
    NewChainStep,
    RecordedStep,
} from "./work-chains.contracts"
import { MAX_AUTOMATIC_STEPS } from "./work-chains.contracts"
import { InjectChainOwnerDirectory } from "./work-chains.decorators"
import type { ChainOwnerDirectory } from "./work-chains.port"
import type {
    ActorNameRow,
    ChainStepRow,
    ChainThreadRow,
    InsertedIdRow,
    MemberIdRow,
    SettledApprovalRow,
    WorkspaceOwnerRow,
} from "./persistence/work-chains.rows"
import {
    ABANDON_CHAIN_STEP,
    FIND_ACTIVE_MEMBER_IDS,
    FIND_ACTOR_NAME,
    FIND_CHAIN_STEP,
    FIND_WORKSPACE_OWNER,
    INSERT_CHAIN_STEP,
    LINK_APPROVAL_STEP,
    LIST_CHAIN_STEPS,
    LOCK_CHAIN_THREAD,
    SETTLE_APPROVAL_STEP,
    SETTLE_TARGETED_STEPS,
} from "./persistence/work-chains.sql"

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
        const rows = await this.entityManager.query<Array<ChainStepRow>>(LIST_CHAIN_STEPS, [workspaceId, threadId])
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
        await manager.query(SETTLE_TARGETED_STEPS, [workspaceId, threadId, actor.kind, actor.id])
    }

    /** Settles the approval step of a request: approved is done, the others end as they are, and the evidence log says who. */
    async settleApproval(outcome: ApprovalStepOutcome, manager: EntityManager = this.entityManager): Promise<void> {
        const status: ChainStepStatus = outcome.outcome === "approved" ? "done" : outcome.outcome
        const [settled] = await manager.query<Array<SettledApprovalRow>>(SETTLE_APPROVAL_STEP, [
            outcome.workspaceId,
            outcome.approvalRequestId,
            status,
            outcome.decidedBy,
        ])
        if (settled === undefined) return
        const decider =
            outcome.decidedBy === null
                ? ""
                : await this.nameOf(manager, outcome.workspaceId, "member", outcome.decidedBy)
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
                leadId: settled.lead_id,
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
        await manager.query(LINK_APPROVAL_STEP, [workspaceId, stepId, requestId])
    }

    /** Ends a waiting step as stopped when the request it waited for could not be opened. */
    async abandon(workspaceId: string, stepId: string): Promise<void> {
        await this.entityManager.query(ABANDON_CHAIN_STEP, [workspaceId, stepId])
    }

    /** The member to tag when an agent's work comes back to its owner: the owner, else the fallback, else the workspace owner. */
    async ownerTagOf(
        workspaceId: string,
        agentId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<MentionRef> {
        const owner = await this.owners.ownerOf(agentId)
        const active = await manager.query<Array<MemberIdRow>>(FIND_ACTIVE_MEMBER_IDS, [
            workspaceId,
            [owner.ownerMemberId, owner.fallbackMemberId],
        ])
        const present = new Set(active.map((row) => row.id))
        const chosen = [owner.ownerMemberId, owner.fallbackMemberId].find((id) => present.has(id))
        if (chosen !== undefined) return { kind: "member", id: chosen }
        const [workspace] = await manager.query<Array<WorkspaceOwnerRow>>(FIND_WORKSPACE_OWNER, [workspaceId])
        return { kind: "member", id: workspace?.id ?? owner.fallbackMemberId }
    }

    private async recordIn(tx: EntityManager, step: NewChainStep): Promise<RecordedStep> {
        const [thread] = await tx.query<Array<ChainThreadRow>>(LOCK_CHAIN_THREAD, [step.workspaceId, step.threadId])
        if (thread === undefined) throw new WorkChainsError({ code: WorkChainsErrorCode.ThreadNotFound })
        const history = (await tx.query<Array<ChainStepRow>>(LIST_CHAIN_STEPS, [step.workspaceId, step.threadId])).map(
            toChainStep,
        )
        const verdict = judgeStep(history, step)
        if (verdict.kind === "continue") {
            const stored = await this.store(tx, step, initialStatusOf(step), thread.lead_id)
            return { step: stored, verdict: "continue", stopReason: null, ownerTag: null }
        }
        const ownerTag = await this.ownerTagOf(step.workspaceId, step.actor.id, tx)
        const detail = this.catalog.get(`chain.stopped.${verdict.reason}`, { max: MAX_AUTOMATIC_STEPS }, step.locale)
        const stored = await this.store(
            tx,
            { ...step, kind: "hand_off", target: ownerTag, detail, approvalRequestId: null },
            "stopped",
            thread.lead_id,
        )
        return { step: stored, verdict: "stopped", stopReason: verdict.reason, ownerTag }
    }

    private async store(
        tx: EntityManager,
        step: NewChainStep,
        status: ChainStepStatus,
        leadId: string | null,
    ): Promise<ChainStep> {
        const [inserted] = await tx.query<Array<InsertedIdRow>>(INSERT_CHAIN_STEP, [
            step.workspaceId,
            step.threadId,
            step.actor.kind,
            step.actor.id,
            step.kind,
            step.action,
            step.detail,
            step.rule,
            step.target === null ? null : JSON.stringify(step.target),
            step.approvalRequestId,
            status,
        ])
        if (inserted === undefined) throw new WorkChainsError({ code: WorkChainsErrorCode.NotStored })
        const [row] = await tx.query<Array<ChainStepRow>>(FIND_CHAIN_STEP, [step.workspaceId, inserted.id])
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

    private async nameOf(manager: EntityManager, workspaceId: string, kind: string, id: string): Promise<string> {
        const [row] = await manager.query<Array<ActorNameRow>>(FIND_ACTOR_NAME, [workspaceId, kind, id])
        return row?.name ?? ""
    }
}
