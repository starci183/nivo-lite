import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ChatReplyProgress } from "./chatreply.contracts"
import { ChatreplyError, ChatreplyErrorCode } from "./errors/chatreply.error"
import type { AnswerProgressRow, ReplyProgressRow } from "./persistence/chatreply.rows"
import { FIND_ANSWER_PROGRESS, FIND_REPLY_PROGRESS } from "./persistence/chatreply.sql"

@Injectable()
/** Reads the existing queued jobs and their durable result rows for a verified member of the selected workspace. */
export class ChatReplyStatusService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The stored human reply's delivery and the terminal outcome of its delivery job. */
    async replyStatus(principalId: string, workspaceId: string, messageId: string): Promise<ChatReplyProgress> {
        await this.members.require(principalId, workspaceId)
        const row = (
            await this.entityManager.query<Array<ReplyProgressRow>>(FIND_REPLY_PROGRESS, [workspaceId, messageId])
        )[0]
        if (row === undefined) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
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
        const row = (
            await this.entityManager.query<Array<AnswerProgressRow>>(FIND_ANSWER_PROGRESS, [workspaceId, workItemId])
        )[0]
        if (row === undefined) throw new ChatreplyError({ code: ChatreplyErrorCode.NotFound })
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
}
