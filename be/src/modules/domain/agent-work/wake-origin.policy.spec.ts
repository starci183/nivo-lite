import { wakeOriginOf } from "./wake-origin.policy"

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
            { source: "tag", context: { fromAgentId: "a1", conversationId: "c1" }, actorMemberId: null },
            "agent",
        ],
        ["another agent's end node", { source: "tag", context: { threadId: "t1" }, actorMemberId: null }, "agent"],
    ] as const)("names %s", (_case, wake, origin) => {
        expect(wakeOriginOf(wake)).toBe(origin)
    })
})
