import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChatReplyStatusService } from "./chatreply-status.service"
import { ChatreplyErrorCode } from "./errors/chatreply.error"
import { FIND_ANSWER_PROGRESS, FIND_REPLY_PROGRESS } from "./persistence/chatreply.sql"

const build = async () => {
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatReplyStatusService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(ChatReplyStatusService), entityManager, members }
}

describe("ChatReplyStatusService", () => {
    describe("replyStatus", () => {
        it("replyStatus has its first case written", async () => {
            const { service } = await build()
            expect(service.replyStatus).toBeInstanceOf(Function)
        })

        it("refuses a reply absent from the verified workspace", async () => {
            const { service, entityManager, members } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.replyStatus("user-1", "ws-1", "message-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(entityManager.query).toHaveBeenCalledWith(FIND_REPLY_PROGRESS, ["ws-1", "message-1"])
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
                entityManager.query.mockResolvedValue([
                    { id: "message-1", delivery_status: deliveryStatus, job_state: jobState },
                ])

                await expect(service.replyStatus("user-1", "ws-1", "message-1")).resolves.toEqual({
                    id: "message-1",
                    status,
                    messageId: "message-1",
                    delivery,
                    errorCode,
                })
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(entityManager.query).toHaveBeenCalledWith(FIND_REPLY_PROGRESS, ["ws-1", "message-1"])
            },
        )
    })

    describe("answerStatus", () => {
        it("answerStatus has its first case written", async () => {
            const { service } = await build()
            expect(service.answerStatus).toBeInstanceOf(Function)
        })

        it("refuses an answer absent from the verified workspace", async () => {
            const { service, entityManager, members } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.answerStatus("user-1", "ws-1", "work-1")).rejects.toMatchObject({
                code: ChatreplyErrorCode.NotFound,
            })
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(entityManager.query).toHaveBeenCalledWith(FIND_ANSWER_PROGRESS, ["ws-1", "work-1"])
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
                const { service, entityManager, members } = await build()
                entityManager.query.mockResolvedValue([
                    {
                        id: "work-1",
                        work_status: workStatus,
                        delivery_status: deliveryStatus,
                        job_state: jobState,
                        message_id: messageId,
                    },
                ])

                await expect(service.answerStatus("user-1", "ws-1", "work-1")).resolves.toEqual({
                    id: "work-1",
                    messageId,
                    delivery: deliveryStatus,
                    status,
                    errorCode,
                })
                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
                expect(entityManager.query).toHaveBeenCalledWith(FIND_ANSWER_PROGRESS, ["ws-1", "work-1"])
            },
        )
    })
})
