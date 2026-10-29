import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkDrainService, WorkEngineService } from "@modules/domain/decisions"
import { ThreadApprovalsService, ThreadMessagesService } from "@modules/domain/thread-messages"
import type { ThreadCardDecision, ThreadMessage, UserPost } from "@modules/domain/thread-messages"
import type { ResumeDecision, WorkContext, WorkEdits } from "@modules/domain/decisions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { ThreadWorkError, ThreadWorkErrorCode } from "./errors/thread-work.error"
import { ThreadWorkEntity } from "./persistence/entities"
import { ThreadWorkLogEvent } from "./thread-work.log-events"
import { toThreadWorkRecord } from "./thread-work.mapper"
import { deciderOf, replyEdits, seedOf, workAgentOf } from "./thread-work.policy"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"
import type {
    DeciderRecord,
    MemberDecider,
    MemberReply,
    SettledAskRecord,
    ThreadWorkRecord,
    ThreadWorkStart,
    ThreadWorkTick,
    WorkAgent,
    WorkAgentRecord,
    WorkLeadRecord,
} from "./thread-work.contracts"

/** The most settled approvals one tick moves on. */
const SETTLED_BATCH = 20

/** Who the runtime acts as when no person is acting. */
const RUNTIME_ACTOR = "NIVO"

@Injectable()
/**
 * The agents' runtime in work threads. A member gives an agent work (an action of its department about a customer) and the agent
 * starts it through the work engine; when the approval it asked for is settled, or the member it asked for data answers, the same
 * work item resumes and the agent goes on. Settled approvals are moved on right after a decision and, for the other doors (the
 * deadline, a decision elsewhere), by the minute drain tick.
 */
export class ThreadWorkService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly engine: WorkEngineService,
        private readonly modules: ModuleCatalogService,
        private readonly rules: AuthorityRulesService,
        private readonly turns: ThreadWorkTurnsService,
        private readonly messages: ThreadMessagesService,
        private readonly approvals: ThreadApprovalsService,
        private readonly drain: WorkDrainService,
    ) {}

    /**
     * The minute tick of the agents' work: the queued chain steps of every workspace go through the policy gate, then the agents
     * whose approval was settled by any door go on in their threads. Answers how many of each moved.
     */
    async tick(): Promise<ThreadWorkTick> {
        const steps = await this.drain.drainAll()
        const settled = await this.resumeSettled()
        return { steps, settled }
    }

    /** A member writes in a thread; when an agent waited for their data, its work goes on with the answer. */
    async post(post: UserPost): Promise<ThreadMessage> {
        const message = await this.messages.postAsUser(post)
        await this.memberReplied({
            workspaceId: post.workspaceId,
            threadId: post.threadId,
            memberId: message.authorId,
            body: post.body,
        })
        return message
    }

    /** A member decides an approval card; once the request is settled, the agent that asked goes on. */
    async decide(decision: ThreadCardDecision): Promise<ThreadMessage> {
        const message = await this.approvals.decide(decision)
        if (message.approval !== null) await this.approvalSettled(message.approval.requestId)
        return message
    }

    /** Starts the work a member handed an agent in a thread; the action must be one the agent's department performs. */
    async start(input: ThreadWorkStart): Promise<void> {
        const agent = await this.agentOf(input.workspaceId, input.agentId)
        if (agent === null) throw new ThreadWorkError({ code: ThreadWorkErrorCode.AgentNotFound })
        const entry = await this.modules.actionOf(input.task.action)
        if (entry?.moduleKey !== agent.module) {
            throw new ThreadWorkError({ code: ThreadWorkErrorCode.ActionNotOfAgent })
        }
        const lead = await this.entityManager
            .createQueryBuilder()
            .select(["l.id AS id", "l.contact_name AS contact_name"])
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId AND l.id = :leadId", {
                workspaceId: input.workspaceId,
                leadId: input.task.leadId,
            })
            .limit(1)
            .getRawOne<WorkLeadRecord>()
        if (lead === undefined) throw new ThreadWorkError({ code: ThreadWorkErrorCode.LeadNotFound })
        const setup = await this.rules.approvalSetup(input.workspaceId, input.task.action)
        await this.turns.run({
            workspaceId: input.workspaceId,
            threadId: input.threadId,
            agent,
            action: input.task.action,
            leadId: lead.id,
            seed: seedOf(input.summary, input.task, lead, setup?.unit ?? "vnd"),
            parentId: null,
            actorName: input.actorName,
        })
    }

    /** A member answered in a thread: the work that waited for their data resumes with it. Answers whether one did. */
    async memberReplied(reply: MemberReply): Promise<boolean> {
        const found = await this.entityManager.findOne(ThreadWorkEntity, {
            where: {
                workspaceId: reply.workspaceId,
                threadId: reply.threadId,
                waitingMemberId: reply.memberId,
                state: "waiting_member",
            },
            order: { updatedAt: "ASC" },
        })
        const row = found === null ? undefined : toThreadWorkRecord(found)
        const decider = row === undefined ? null : await this.deciderOf(row.workspace_id, reply.memberId)
        if (row === undefined || decider === null) return false
        try {
            await this.resume(row, "approved", replyEdits(row.missing_fields, reply.body), decider)
        } catch (cause) {
            this.logger.error(ThreadWorkLogEvent.ReplyFailed, cause, { workId: row.id })
        }
        return true
    }

    /** Moves on the work of one approval request once it is settled (right after a member decided it). */
    async approvalSettled(requestId: string): Promise<void> {
        const rows = await this.settledAsks()
            .andWhere("w.approval_request_id = :requestId", { requestId })
            .limit(1)
            .getRawMany<SettledAskRecord>()
        await eachInOrder(rows, (row) => this.settle(row))
    }

    /** The minute tick: moves on the work whose approval was settled by any door (a decision, the deadline). Answers how many. */
    async resumeSettled(): Promise<number> {
        const rows = await this.settledAsks()
            .orderBy("w.updated_at", "ASC")
            .limit(SETTLED_BATCH)
            .getRawMany<SettledAskRecord>()
        await eachInOrder(rows, (row) => this.settle(row))
        return rows.length
    }

    /**
     * Approved: the work resumes as the decider's and the agent goes on. Refused: the work stops as the decider's (the thread already
     * sent it back to the owner). Expired: the work waits for the owner, who the thread already tagged.
     */
    private async settle(row: SettledAskRecord): Promise<void> {
        const decider = row.resolved_by === null ? null : await this.deciderOf(row.workspace_id, row.resolved_by)
        try {
            if (row.request_status === "approved" && decider !== null) {
                await this.resume(row, "approved", {}, decider)
                return
            }
            if (row.request_status === "rejected" && decider !== null) {
                await this.engine.resumeWork(this.ctxOf(row), row.work_item_id, "rejected", {}, decider)
            }
        } catch (cause) {
            this.logger.error(ThreadWorkLogEvent.ResumeFailed, cause, { workId: row.id })
        }
        await this.turns.move(
            { workspaceId: row.workspace_id, workId: row.id },
            {
                state: "stopped",
                requestId: row.approval_request_id,
                memberId: null,
                missing: [],
            },
        )
    }

    private async resume(
        row: ThreadWorkRecord,
        decision: ResumeDecision,
        edits: WorkEdits,
        by: MemberDecider,
    ): Promise<void> {
        const agent = await this.agentOf(row.workspace_id, row.agent_id)
        const item = await this.engine.resumeWork(this.ctxOf(row), row.work_item_id, decision, edits, by)
        if (agent === null) return
        await this.turns.react(
            { workspaceId: row.workspace_id, threadId: row.thread_id, workId: row.id, agent, locale: "vi" },
            item,
        )
    }

    private ctxOf(row: ThreadWorkRecord): WorkContext {
        return { workspaceId: row.workspace_id, actor: RUNTIME_ACTOR, locale: "vi" }
    }

    private async agentOf(workspaceId: string, agentId: string): Promise<WorkAgent | null> {
        const row = await this.entityManager
            .createQueryBuilder()
            .select(["a.id AS id", "a.name AS name", "a.module AS module", "a.can_tag_agent_ids AS can_tag_agent_ids"])
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId AND a.id = :agentId AND a.status = 'active'", {
                workspaceId,
                agentId,
            })
            .limit(1)
            .getRawOne<WorkAgentRecord>()
        return row === undefined ? null : workAgentOf(row)
    }

    private async deciderOf(workspaceId: string, memberId: string): Promise<MemberDecider | null> {
        const row = await this.entityManager
            .createQueryBuilder()
            .select(["m.id AS id", "m.display_name AS display_name", "m.role AS role"])
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.id = :memberId", { workspaceId, memberId })
            .limit(1)
            .getRawOne<DeciderRecord>()
        return row === undefined ? null : deciderOf(row)
    }

    /** The thread work that asked for an approval whose request has since been settled, with how it ended. */
    private settledAsks(): SelectQueryBuilder<ThreadWorkEntity> {
        return this.entityManager
            .createQueryBuilder(ThreadWorkEntity, "w")
            .innerJoin("approval_requests", "r", "r.id = w.approval_request_id")
            .select([
                "w.id AS id",
                "w.workspace_id AS workspace_id",
                "w.thread_id AS thread_id",
                "w.work_item_id AS work_item_id",
                "w.agent_id AS agent_id",
                "w.state AS state",
                "w.approval_request_id AS approval_request_id",
                "w.waiting_member_id AS waiting_member_id",
                "w.missing_fields AS missing_fields",
                "r.status AS request_status",
                "r.resolved_by AS resolved_by",
            ])
            .where("w.state = 'asked' AND r.status <> 'pending'")
    }
}
