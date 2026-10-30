import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessageDeliveriesService } from "@modules/domain/agent-messages"
import { WorkItemsReplyProgressService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChatReplyStatusService } from "./chatreply-status.service"
import { ChatreplyErrorCode } from "./errors/chatreply.error"

/** The statement `callDbFunction` sends for the job state. */
const JOB_STATUS = "SELECT * FROM public.job_status($1, $2, $3, $4)"

/** The human reply the message reads answer, and whether its conversation is a customer conversation. */
interface ReplyWorld {
    readonly deliveryStatus: string | null
    readonly customerChat: boolean
}

const build = async (reply: ReplyWorld | null = null) => {
    const deliveries = mock<AgentMessageDeliveriesService>()
    deliveries.humanReplyById.mockResolvedValue(
        reply === null ? null : { id: "message-1", conversationId: "c1", deliveryStatus: reply.deliveryStatus },
    )
    const conversations = mock<AgentConversationsReadService>()
    conversations.customerChat.mockResolvedValue(reply?.customerChat === true ? { id: "c1", leadId: null } : null)
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const progress = mock<WorkItemsReplyProgressService>()
    progress.replyItemOf.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatReplyStatusService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WorkItemsReplyProgressService, useValue: progress },
            { provide: AgentMessageDeliveriesService, useValue: deliveries },
            { provide: AgentConversationsReadService, useValue: conversations },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChatReplyStatusService),
        entityManager,
        members,
        progress,
        deliveries,
        conversations,
    }
}

/** What the job function answers for one job: its row, or nothing for a job that does not exist. */
const jobAnswer = (state: string | null) => (state === null ? [] : [{ id: "job-1", state }])

describe("ChatReplyStatusService", () => {
    describe("replyStatus", () => {
        it("replyStatus exercises its first behavior through the compiled module", async () => {
            const { service, members, deliveries } = await build()

            await expect(service.replyStatus("user-1", "ws-1", "message-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(deliveries.humanReplyById).toHaveBeenCalledWith("ws-1", "message-1")

            expect(service.replyStatus).toBeInstanceOf(Function)
        })

        it("refuses a reply absent from the verified workspace", async () => {
            const { service, entityManager, members } = await build({ deliveryStatus: null, customerChat: false })

            await expect(service.replyStatus("user-1", "ws-1", "message-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it.each([
            ["sent", "failed", "succeeded", "sent", null],
            ["failed", null, "failed", "failed", "CHATREPLY_DELIVERY_FAILED"],
            [null, "failed", "failed", null, "CHATREPLY_DELIVERY_FAILED"],
            [null, "done", "failed", null, "CHATREPLY_DELIVERY_FAILED"],
            [null, "running", "running", null, null],
            [null, null, "queued", null, null],
        ] as const)(
            "maps delivery %s and job %s to %s",
            async (deliveryStatus, jobState, status, delivery, errorCode) => {
                const { service, entityManager, members } = await build({ deliveryStatus, customerChat: true })
                entityManager.query.mockResolvedValue(jobAnswer(jobState))

                await expect(service.replyStatus("user-1", "ws-1", "message-1")).resolves.toEqual({
                    id: "message-1",
                    status,
                    messageId: "message-1",
                    delivery,
                    errorCode,
                })
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(entityManager.query).toHaveBeenCalledWith(JOB_STATUS, [
                    "ws-1",
                    "chat_turn",
                    "chat-turn.deliver",
                    "chat-turn.deliver:message-1",
                ])
            },
        )
    })
})

describe("ChatReplyStatusService", () => {
    describe("answerStatus", () => {
        it("answerStatus exercises its first behavior through the compiled module", async () => {
            const { service, members, progress } = await build()

            await expect(service.answerStatus("user-1", "ws-1", "work-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(progress.replyItemOf).toHaveBeenCalledWith("ws-1", "work-1")

            expect(service.answerStatus).toBeInstanceOf(Function)
        })

        it("refuses an answer absent from the verified workspace", async () => {
            const { service, entityManager, members } = await build()

            await expect(service.answerStatus("user-1", "ws-1", "work-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it("refuses an answer whose conversation is not a customer conversation", async () => {
            const { service, entityManager, progress, conversations } = await build()
            progress.replyItemOf.mockResolvedValue({ id: "work-1", status: "done", conversationId: "c1" })
            conversations.customerChat.mockResolvedValue(null)

            await expect(service.answerStatus("user-1", "ws-1", "work-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it.each([
            ["rejected", null, "failed", null, "succeeded", null],
            ["done", "sent", "failed", "message-1", "succeeded", null],
            ["failed", null, null, null, "failed", "CHATREPLY_ANSWER_FAILED"],
            ["waiting_decision", null, "failed", null, "failed", "CHATREPLY_ANSWER_FAILED"],
            ["done", "failed", null, "message-1", "failed", "CHATREPLY_DELIVERY_FAILED"],
            ["done", null, null, null, "failed", "CHATREPLY_ANSWER_BLOCKED"],
            ["waiting_decision", null, "done", null, "failed", "CHATREPLY_ANSWER_BLOCKED"],
            ["waiting_decision", null, "running", null, "running", null],
            ["waiting_decision", null, null, null, "queued", null],
        ] as const)(
            "maps work %s, delivery %s and job %s",
            async (workStatus, deliveryStatus, jobState, messageId, status, errorCode) => {
                const { service, entityManager, members, progress, deliveries, conversations } = await build()
                progress.replyItemOf.mockResolvedValue({ id: "work-1", status: workStatus, conversationId: "c1" })
                conversations.customerChat.mockResolvedValue({ id: "c1", leadId: null })
                deliveries.humanReplyOf.mockResolvedValue(
                    messageId === null && deliveryStatus === null ? null : { id: messageId ?? "message-1", deliveryStatus },
                )
                entityManager.query.mockResolvedValue(jobAnswer(jobState))

                await expect(service.answerStatus("user-1", "ws-1", "work-1")).resolves.toEqual({
                    id: "work-1",
                    messageId,
                    delivery: deliveryStatus,
                    status,
                    errorCode,
                })
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(entityManager.query).toHaveBeenCalledWith(JOB_STATUS, [
                    "ws-1",
                    "decisions",
                    "decisions.decide-work",
                    "decisions.decide-work:work-1",
                ])
            },
        )
    })
})
