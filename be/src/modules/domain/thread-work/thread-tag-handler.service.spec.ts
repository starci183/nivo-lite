import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { AgentTurnView, AgentWakeContext } from "@modules/domain/agent-work"
import { ThreadAgentPostsService, ThreadFeedService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ThreadTagHandlerService } from "./thread-tag-handler.service"

const WAKE_AT = new Date("2026-10-31T10:00:00.000Z")

const turnOf = (context: AgentWakeContext = {}, without: ReadonlyArray<string> = []): AgentTurnView => ({
    workspaceId: "ws-1",
    agentId: "agent-kt",
    scopeKey: "agent",
    fence: 1,
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "tag",
    eventKey: "msg-2",
    context: Object.fromEntries(
        Object.entries({
            threadId: "th-1",
            messageId: "msg-2",
            authorUserId: "user-1",
            locale: "vi",
            ...context,
        }).filter(([key]) => !without.includes(key)),
    ),
    actorMemberId: "member-1",
    attempts: 1,
    maxAttempts: 3,
    wakeCreatedAt: WAKE_AT,
    proposal: null,
})

const messageOf = (id: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
    id,
    threadId: "th-1",
    authorKind: "member",
    authorId: "member-1",
    authorName: "Lan",
    authorRole: "owner",
    body: `body ${id}`,
    quoted: [],
    mentions: [],
    approval: null,
    createdAt: "2026-10-31T09:50:00.000Z",
    ...over,
})

const build = async (messages: ReadonlyArray<ThreadMessage> = [messageOf("msg-1"), messageOf("msg-2")]) => {
    const feed = mock<ThreadFeedService>({
        read: jest.fn().mockResolvedValue({ thread: {}, messages }),
    })
    const posts = mock<ThreadAgentPostsService>({
        postAsAgent: jest.fn().mockResolvedValue({ message: {}, stopped: null }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadTagHandlerService,
            { provide: ThreadFeedService, useValue: feed },
            { provide: ThreadAgentPostsService, useValue: posts },
        ],
    }).compile()
    return { handler: moduleRef.get(ThreadTagHandlerService), feed, posts }
}

describe("ThreadTagHandlerService > talkOf", () => {
    it("reads the thread as the member who tagged and gives the messages before the tagging one", async () => {
        const { handler, feed } = await build([
            messageOf("msg-0", { authorName: "An" }),
            messageOf("msg-1"),
            messageOf("msg-2"),
        ])

        await expect(handler.talkOf(turnOf())).resolves.toEqual({
            before: [
                { id: "msg-0", author: "An", body: "body msg-0" },
                { id: "msg-1", author: "Lan", body: "body msg-1" },
            ],
            tagged: { id: "msg-2", author: "Lan", body: "body msg-2" },
        })
        expect(feed.read).toHaveBeenCalledWith("user-1", "ws-1", "th-1")
    })

    it("keeps only the last twelve messages before the tag", async () => {
        const many = Array.from({ length: 15 }, (_, index) => messageOf(`m${String(index)}`))
        const { handler } = await build([...many, messageOf("msg-2")])

        const talk = await handler.talkOf(turnOf())

        expect(talk?.before).toHaveLength(12)
        expect(talk?.before[0]?.id).toBe("m3")
    })

    it("is undefined when the tagging message is not in the thread", async () => {
        const { handler } = await build([messageOf("msg-1")])

        await expect(handler.talkOf(turnOf())).resolves.toBeUndefined()
    })

    it("is undefined, and reads nothing, when the wake names no thread or no author", async () => {
        const { handler, feed } = await build()

        await expect(handler.talkOf(turnOf({}, ["threadId"]))).resolves.toBeUndefined()
        await expect(handler.talkOf(turnOf({}, ["authorUserId"]))).resolves.toBeUndefined()
        expect(feed.read).not.toHaveBeenCalled()
    })
})

describe("ThreadTagHandlerService > sessionOf", () => {
    it("gives each thread its own session", async () => {
        const { handler } = await build()

        expect(handler.sessionOf(turnOf())).toBe("thread:th-1")
        expect(handler.sessionOf(turnOf({}, ["threadId"]))).toBe("thread:")
    })
})

describe("ThreadTagHandlerService > say", () => {
    it("writes the answer through the thread's own door as the agent, tagging nobody", async () => {
        const { handler, posts } = await build()

        await handler.say(turnOf({ locale: "en" }), { id: "agent-kt" }, "It is 5tr.")

        expect(posts.postAsAgent.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    threadId: "th-1",
                    agentId: "agent-kt",
                    body: "It is 5tr.",
                    mentions: [],
                    quoted: [],
                    stepTitle: null,
                    approval: null,
                    locale: "en",
                },
            ],
        ])
    })

    it("answers in Vietnamese when the wake carried no language", async () => {
        const { handler, posts } = await build()

        await handler.say(turnOf({}, ["locale"]), { id: "agent-kt" }, "Xong")

        expect(posts.postAsAgent).toHaveBeenCalledWith(expect.objectContaining({ locale: "vi" }))
    })

    it("posts once under a retry: the same words by the same agent since the wake are not written again", async () => {
        const said = messageOf("msg-3", {
            authorKind: "agent",
            authorId: "agent-kt",
            body: "It is 5tr.",
            createdAt: "2026-10-31T10:00:05.000Z",
        })
        const { handler, posts } = await build([messageOf("msg-2"), said])

        await handler.say(turnOf(), { id: "agent-kt" }, "It is 5tr.")

        expect(posts.postAsAgent).not.toHaveBeenCalled()
    })

    it.each([
        ["other words", { body: "Something else" }],
        ["another agent", { authorId: "agent-sa" }],
        ["a member", { authorKind: "member" as const }],
        ["before the wake", { createdAt: "2026-10-31T09:00:00.000Z" }],
    ])("writes the answer when the matching message is %s", async (_name, over) => {
        const earlier = messageOf("msg-3", {
            authorKind: "agent",
            authorId: "agent-kt",
            body: "It is 5tr.",
            createdAt: "2026-10-31T10:00:05.000Z",
            ...over,
        })
        const { handler, posts } = await build([messageOf("msg-2"), earlier])

        await handler.say(turnOf(), { id: "agent-kt" }, "It is 5tr.")

        expect(posts.postAsAgent).toHaveBeenCalledTimes(1)
    })

    it("writes nothing when the wake names no thread", async () => {
        const { handler, posts, feed } = await build()

        await handler.say(turnOf({}, ["threadId"]), { id: "agent-kt" }, "x")

        expect(feed.read).not.toHaveBeenCalled()
        expect(posts.postAsAgent).not.toHaveBeenCalled()
    })
})
