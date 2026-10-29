import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { WorkItemsReplyProgressService } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChatReplyStatusService } from "./chatreply-status.service"
import { ChatreplyErrorCode } from "./errors/chatreply.error"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

/** The statement `callDbFunction` sends for the job state. */
const JOB_STATUS = "SELECT * FROM public.job_status($1, $2, $3, $4)"

const build = async () => {
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const progress = mock<WorkItemsReplyProgressService>()
    progress.answerProgress.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatReplyStatusService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WorkItemsReplyProgressService, useValue: progress },
        ],
    }).compile()
    return { service: moduleRef.get(ChatReplyStatusService), entityManager, members, progress }
}

/** What the job function answers for one job: its row, or nothing for a job that does not exist. */
const jobAnswer = (state: string | null) => (state === null ? [] : [{ id: "job-1", state }])

describe("ChatReplyStatusService", () => {
    describe("replyStatus", () => {
        it("replyStatus exercises its first behavior through the compiled module", async () => {
            const { service, entityManager, members } = await build()
            const [read] = queueQueryBuilders(entityManager, [{ getRawOne: undefined }])

            await expect(service.replyStatus("user-1", "ws-1", "message-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(AgentMessageEntity, "m")
            expect(read?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", messageId: "message-1" })

            expect(service.replyStatus).toBeInstanceOf(Function)
        })

        it("refuses a reply absent from the verified workspace", async () => {
            const { service, entityManager, members } = await build()
            queueQueryBuilders(entityManager, [{ getRawOne: undefined }])

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
                const { service, entityManager, members } = await build()
                queueQueryBuilders(entityManager, [{ getRawOne: { id: "message-1", delivery_status: deliveryStatus } }])
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
            expect(progress.answerProgress).toHaveBeenCalledWith("ws-1", "work-1")

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
                const { service, entityManager, members, progress } = await build()
                progress.answerProgress.mockResolvedValue({
                    id: "work-1",
                    work_status: workStatus,
                    delivery_status: deliveryStatus,
                    message_id: messageId,
                })
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
