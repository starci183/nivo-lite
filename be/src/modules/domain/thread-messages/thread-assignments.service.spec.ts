import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkThreadsService } from "@modules/domain/work-threads"
import type { WorkThread } from "@modules/domain/work-threads"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import { ThreadAssignmentsService } from "./thread-assignments.service"
import { ThreadMessagesService } from "./thread-messages.service"
import type { ThreadMessage } from "./thread-messages.contracts"

const THREAD: WorkThread = {
    id: "thread-1",
    workspaceId: "ws-1",
    title: "Give work to AI Sales",
    leadId: null,
    orderId: null,
    status: "open",
    createdBy: "member-van",
    createdAt: "2026-10-22T02:41:00.000Z",
    updatedAt: "2026-10-22T02:41:00.000Z",
}

const MESSAGE: ThreadMessage = {
    id: "msg-1",
    threadId: "thread-1",
    authorKind: "member",
    authorId: "member-van",
    authorName: "Van",
    authorRole: "staff",
    body: "Continue the order of Ms Thao",
    quoted: [],
    mentions: [],
    approval: null,
    createdAt: "2026-10-22T02:41:00.000Z",
}

const AGENT = "22222222-2222-4222-8222-222222222222"

const build = async (failure?: Error) => {
    const em = mockEntityManager()
    fakeTransaction(em)
    const directory = mock<MentionDirectoryService>({ ensureMember: jest.fn().mockResolvedValue(undefined) })
    const threads = mock<WorkThreadsService>({ createFor: jest.fn().mockResolvedValue(THREAD) })
    const messages = mock<ThreadMessagesService>({
        postAsMember:
            failure === undefined ? jest.fn().mockResolvedValue(MESSAGE) : jest.fn().mockRejectedValue(failure),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadAssignmentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MentionDirectoryService, useValue: directory },
            { provide: WorkThreadsService, useValue: threads },
            { provide: ThreadMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadAssignmentsService), em, directory, threads, messages }
}

const input = {
    workspaceId: "ws-1",
    authorMemberId: "member-van",
    title: "Give work to AI Sales",
    text: "Continue the order of Ms Thao",
    mentions: [{ kind: "agent" as const, id: AGENT }],
}

describe("ThreadAssignmentsService", () => {
    it("opens a thread and writes the text as the member's first message tagging the agent, in one transaction", async () => {
        const { service, directory, threads, messages } = await build()

        await expect(service.open(input)).resolves.toEqual({ threadId: "thread-1" })

        expect(directory.ensureMember).toHaveBeenCalledWith(expect.anything(), "ws-1", "member-van")
        expect(threads.createFor).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                memberId: "member-van",
                title: "Give work to AI Sales",
                leadId: null,
                orderId: null,
            },
            expect.anything(),
        )
        expect(messages.postAsMember).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                threadId: "thread-1",
                memberId: "member-van",
                body: "Continue the order of Ms Thao",
                mentions: [{ kind: "agent", id: AGENT }],
                quoted: [],
                locale: "vi",
            },
            expect.anything(),
        )
    })

    it("writes in the language the caller names", async () => {
        const { service, messages } = await build()

        await service.open({ ...input, locale: "en" })

        expect(messages.postAsMember).toHaveBeenCalledWith(expect.objectContaining({ locale: "en" }), expect.anything())
    })

    it("lets a refusal travel so the whole transaction, thread included, rolls back", async () => {
        const refusal = Object.assign(new Error("no"), { code: ThreadMessagesErrorCode.AssignNotAllowed })
        const { service } = await build(refusal)

        await expect(service.open(input)).rejects.toBe(refusal)
    })
})
