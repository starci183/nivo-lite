import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { ThreadMessage, UserPost } from "@modules/domain/thread-messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE } from "@tests/fixtures/builders/thread-work-service.builder"
import { ThreadTagWakesService } from "./thread-tag-wakes.service"

const POST: UserPost = {
    workspaceId: "ws-1",
    threadId: "thread-1",
    userId: "u-lan",
    body: "ping",
    mentions: [],
    quoted: [],
    locale: "en",
}

const tagging = (...mentions: ReadonlyArray<{ kind: "member" | "agent" | "group"; id: string }>): ThreadMessage => ({
    ...MESSAGE,
    authorId: "m-lan",
    mentions: mentions.map((mention) => ({ ...mention, name: mention.id })),
})

const build = async () => {
    const em = mockEntityManager({})
    const transaction = fakeTransaction(em)
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadTagWakesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentWakeService, useValue: wakes },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadTagWakesService), transaction, wakes }
}

describe("ThreadTagWakesService > wake", () => {
    it("wakes each agent the message tags, once, in one transaction, keyed by the message", async () => {
        const { service, wakes, transaction } = await build()

        await service.wake(
            POST,
            tagging({ kind: "agent", id: "agent-1" }, { kind: "member", id: "m-2" }, { kind: "agent", id: "agent-2" }),
        )

        expect(transaction.commits).toBe(1)
        expect(wakes.wake.mock.calls.map(([, wake]) => wake)).toEqual(
            ["agent-1", "agent-2"].map((agentId) => ({
                workspaceId: "ws-1",
                agentId,
                source: "tag",
                eventKey: "msg-1",
                context: { threadId: "thread-1", messageId: "msg-1", authorUserId: "u-lan", locale: "en" },
                actorMemberId: "m-lan",
            })),
        )
    })

    it("wakes nobody, and opens no transaction, when the message tags only people and groups", async () => {
        const { service, wakes, transaction } = await build()

        await service.wake(POST, tagging({ kind: "member", id: "m-2" }, { kind: "group", id: "g-1" }))

        expect(wakes.wake).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual([])
    })

    it("rolls the wakes back together when one cannot be written", async () => {
        const { service, wakes, transaction } = await build()
        const failure = new Error("queue down")
        wakes.wake.mockRejectedValue(failure)

        await expect(service.wake(POST, tagging({ kind: "agent", id: "agent-1" }))).rejects.toBe(failure)

        expect(transaction.rollbacks).toBe(1)
    })
})
