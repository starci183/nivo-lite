import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import type { ChatActivity, ChatNewest } from "./agent-messages-read.contracts"
import { AgentMessagesReadService } from "./agent-messages-read.service"
import { AgentTestChatsService } from "./agent-test-chats.service"

const READER = { userId: "u-1", displayName: "Mai Linh" }

const newest = (id: string, sortAt: string, extra: Partial<ChatNewest> = {}): ChatNewest => ({
    id,
    body: `line ${id}`,
    author_user_id: "u-2",
    author_name: null,
    at: `at ${sortAt}`,
    sort_at: sortAt,
    ...extra,
})

const build = async (chats: Array<{ id: string; agentId: string }>, activity: Array<ChatActivity>) => {
    const conversations = mock<AgentConversationsReadService>({ testChatsOf: jest.fn().mockResolvedValue(chats) })
    const lines = mock<AgentMessagesReadService>({ chatActivity: jest.fn().mockResolvedValue(activity) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTestChatsService,
            { provide: AgentConversationsReadService, useValue: conversations },
            { provide: AgentMessagesReadService, useValue: lines },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTestChatsService), conversations, lines }
}

describe("AgentTestChatsService", () => {
    it("adds the unread lines of an agent's test chats (capped) and takes the newest line of them", async () => {
        const { service, conversations, lines } = await build(
            [
                { id: "c-1", agentId: "a-1" },
                { id: "c-2", agentId: "a-1" },
                { id: "c-3", agentId: "a-1" },
                { id: "c-4", agentId: "a-2" },
            ],
            [
                { conversationId: "c-1", unread: 60, newest: newest("m-1", "20261029100000000000") },
                { conversationId: "c-2", unread: 60, newest: newest("m-2", "20261029110000000000") },
                { conversationId: "c-3", unread: 0, newest: newest("m-3", "20261029080000000000") },
                { conversationId: "c-4", unread: 2, newest: undefined },
            ],
        )

        await expect(
            service.activityOf("ws-1", READER, [
                { agentId: "a-1", readAt: "2026-10-29T09:00:00.123456+00:00" },
                { agentId: "a-2", readAt: null },
                { agentId: "a-3", readAt: null },
            ]),
        ).resolves.toEqual([
            {
                agentId: "a-1",
                unread: 99,
                newest: {
                    id: "m-2",
                    body: "line m-2",
                    author_user_id: "u-2",
                    author_name: null,
                    at: "at 20261029110000000000",
                },
            },
            { agentId: "a-2", unread: 2, newest: undefined },
            { agentId: "a-3", unread: 0, newest: undefined },
        ])
        expect(conversations.testChatsOf).toHaveBeenCalledWith("ws-1", ["a-1", "a-2", "a-3"], 1000)
        expect(lines.chatActivity).toHaveBeenCalledWith("ws-1", READER, [
            { conversationId: "c-1", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { conversationId: "c-2", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { conversationId: "c-3", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { conversationId: "c-4", readAt: null },
        ])
    })

    it("lets the newer line id win a tie of instants, whichever chat is read first", async () => {
        const { service } = await build(
            [
                { id: "c-1", agentId: "a-1" },
                { id: "c-2", agentId: "a-1" },
                { id: "c-3", agentId: "a-1" },
            ],
            [
                { conversationId: "c-1", unread: 0, newest: newest("m-9", "20261029100000000000") },
                { conversationId: "c-2", unread: 0, newest: newest("m-1", "20261029100000000000") },
                { conversationId: "c-3", unread: 0, newest: newest("m-z", "20261029100000000000") },
            ],
        )

        const [first] = await service.activityOf("ws-1", READER, [{ agentId: "a-1", readAt: null }])

        expect(first?.newest?.id).toBe("m-z")
    })
})
