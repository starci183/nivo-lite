import { Test } from "@nestjs/testing"
import { wakeOriginOf } from "./wake-origin.policy"

const SUBJECT = Symbol("wake-origin.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { wakeOriginOf } }],
    }).compile()
    return moduleRef.get<{ wakeOriginOf: typeof wakeOriginOf }>(SUBJECT)
}

describe("wakeOriginOf", () => {
    it.each([
        ["a clock slot", { source: "schedule", context: {}, actorMemberId: null }, "schedule"],
        ["an internal event such as a bank feed", { source: "internal", context: {}, actorMemberId: null }, "event"],
        [
            "a person tagging in a group",
            { source: "tag", context: { authorUserId: "u1" }, actorMemberId: "m1" },
            "person",
        ],
        [
            "an inbound customer message",
            { source: "customer", context: { conversationId: "c1" }, actorMemberId: null },
            "channel",
        ],
        [
            "a tag on a conversation with nobody behind it",
            { source: "tag", context: { conversationId: "c1" }, actorMemberId: null },
            "channel",
        ],
        [
            "a tag that names the agent behind it",
            { source: "tag", context: { authorAgentId: "a1", conversationId: "c1" }, actorMemberId: null },
            "agent",
        ],
        [
            "a tag a feed or an event started",
            { source: "tag", context: { tagSource: "feed" }, actorMemberId: null },
            "event",
        ],
        ["another agent's end node", { source: "tag", context: { threadId: "t1" }, actorMemberId: null }, "agent"],
    ] as const)("names %s", async (_case, wake, origin) => {
        const policy = await build()

        expect(policy.wakeOriginOf(wake)).toBe(origin)
    })
})
