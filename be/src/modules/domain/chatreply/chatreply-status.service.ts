import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkItemsReplyProgressService } from "@modules/domain/work-items"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessageDeliveriesService } from "@modules/domain/agent-messages"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatReplyProgress } from "./chatreply.contracts"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"
import type { AnswerProgressRow, JobStateRow, ReplyProgressRow } from "./persistence/chatreply.rows"

/** A reply message before its job state is read. */
type MessageProgress = Omit<ReplyProgressRow, "job_state">

@Injectable()
/** Reads the existing queued jobs and their durable result rows for a verified member of the selected workspace. */
export class ChatReplyStatusService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly progress: WorkItemsReplyProgressService,
        private readonly deliveries: AgentMessageDeliveriesService,
        private readonly conversations: AgentConversationsReadService,
    ) {}

    /** The stored human reply's delivery and the terminal outcome of its delivery job. */
    async replyStatus(principalId: string, workspaceId: string, messageId: string): Promise<ChatReplyProgress> {
        await this.members.require(principalId, workspaceId)
        const reply = await this.deliveries.humanReplyById(workspaceId, messageId)
        const chat = reply === null ? null : await this.conversations.customerChat(workspaceId, reply.conversationId)
        const message: MessageProgress | undefined =
            reply === null || chat === null ? undefined : { id: reply.id, delivery_status: reply.deliveryStatus }
        if (message === undefined) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
        const row: ReplyProgressRow = {
            ...message,
            job_state: await this.jobState(
                workspaceId,
                "chat_turn",
                "chat-turn.deliver",
                `chat-turn.deliver:${message.id}`,
            ),
        }
        if (row.delivery_status === "sent")
            return { id: row.id, status: "succeeded", messageId: row.id, delivery: "sent", errorCode: null }
        if (row.delivery_status === "failed" || row.job_state === "failed" || row.job_state === "done") {
            return {
                id: row.id,
                status: "failed",
                messageId: row.id,
                delivery: row.delivery_status,
                errorCode: "CHATREPLY_DELIVERY_FAILED",
            }
        }
        return {
            id: row.id,
            status: row.job_state === "running" ? "running" : "queued",
            messageId: row.id,
            delivery: null,
            errorCode: null,
        }
    }

    /** The escalation decision's job and the approved answer's actual delivery; rejecting an answer completes successfully. */
    async answerStatus(principalId: string, workspaceId: string, workItemId: string): Promise<ChatReplyProgress> {
        await this.members.require(principalId, workspaceId)
        const work = await this.progress.answerProgress(workspaceId, workItemId)
        if (work === null) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
        const row: AnswerProgressRow = {
            ...work,
            job_state: await this.jobState(
                workspaceId,
                "decisions",
                "decisions.decide-work",
                `decisions.decide-work:${work.id}`,
            ),
        }
        const result = { id: row.id, messageId: row.message_id, delivery: row.delivery_status }
        if (row.work_status === "rejected" || (row.work_status === "done" && row.delivery_status === "sent")) {
            return { ...result, status: "succeeded", errorCode: null }
        }
        if (row.work_status === "failed" || row.job_state === "failed")
            return { ...result, status: "failed", errorCode: "CHATREPLY_ANSWER_FAILED" }
        if (row.work_status === "done" || row.job_state === "done") {
            return {
                ...result,
                status: "failed",
                errorCode: row.delivery_status === "failed" ? "CHATREPLY_DELIVERY_FAILED" : "CHATREPLY_ANSWER_BLOCKED",
            }
        }
        return { ...result, status: row.job_state === "running" ? "running" : "queued", errorCode: null }
    }

    /** The state of one job by its dedupe key, null when the job does not exist (an older message has no delivery job). */
    private async jobState(
        workspaceId: string,
        queue: string,
        name: string,
        dedupeKey: string,
    ): Promise<string | null> {
        const [job] = await callDbFunction<JobStateRow>(this.entityManager, "public.job_status", [
            workspaceId,
            queue,
            name,
            dedupeKey,
        ])
        return job?.state ?? null
    }
}
