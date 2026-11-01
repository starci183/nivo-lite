import { Test } from "@nestjs/testing"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { internalWakeOf, splitWakeOf, tagFileRefOf, wakeRefOf, wakeRowOf, wakeScopeOf } from "./intent-wake.policy"

const SUBJECT = Symbol("intent-wake.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { internalWakeOf, splitWakeOf, tagFileRefOf, wakeRefOf, wakeRowOf, wakeScopeOf },
            },
        ],
    }).compile()
    return moduleRef.get<{
        internalWakeOf: typeof internalWakeOf
        splitWakeOf: typeof splitWakeOf
        tagFileRefOf: typeof tagFileRefOf
        wakeRefOf: typeof wakeRefOf
        wakeRowOf: typeof wakeRowOf
        wakeScopeOf: typeof wakeScopeOf
    }>(SUBJECT)
}

const turn = agentTurnViewOf({
    context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "ev-1", authorUserId: "user-1" },
    actorMemberId: "member-1",
    wakeCreatedAt: new Date("2026-11-01T10:00:00.000Z"),
})

describe("intent wake policy", () => {
    it("keeps the ids, flags and moment of a wake in a row", async () => {
        const policy = await build()

        expect(policy.wakeRowOf(turn)).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            scopeKey: "conversation:conv-1",
            wakeId: "wake-1",
            turnId: "turn-1",
            source: "customer",
            eventKey: "msg-1",
            context: turn.context,
            actorMemberId: "member-1",
            attempts: 1,
            maxAttempts: 2,
            wakeCreatedAt: "2026-11-01T10:00:00.000Z",
        })
    })

    it("names the turn and wake of a settle by ids alone, with the author of the tag", async () => {
        const policy = await build()
        const expected = {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            turnId: "turn-1",
            source: "customer",
            authorUserId: "user-1",
        }

        expect(policy.internalWakeOf(turn)).toEqual(expected)
        expect(policy.wakeRefOf(policy.wakeRowOf(turn))).toEqual(expected)
    })

    it("has no author when the wake carries none", async () => {
        const policy = await build()
        const bare = { ...turn, context: {} }

        expect(policy.internalWakeOf(bare).authorUserId).toBeNull()
        expect(policy.wakeRefOf(policy.wakeRowOf(bare)).authorUserId).toBeNull()
    })
})

describe("intent wake policy > the follow-up, the scope and the files", () => {
    it("writes the follow-up of a split with the same facts, pinned, under a key of its own", async () => {
        const policy = await build()

        expect(policy.splitWakeOf(policy.wakeRowOf(turn), "confirm_order")).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            eventKey: "intent:wake-1:confirm_order",
            context: { ...turn.context, intent: "confirm_order" },
            actorMemberId: "member-1",
        })
    })

    it("reads the scope of a turn from its wake: the author of a tag and the pin of a follow-up", async () => {
        const policy = await build()

        expect(policy.wakeScopeOf(turn)).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            authorUserId: "user-1",
            pinned: null,
        })
        expect(policy.wakeScopeOf({ ...turn, context: { intent: "confirm_order" } })).toMatchObject({
            authorUserId: null,
            pinned: "confirm_order",
        })
    })

    it("finds the files of a tag in the line that tagged the agent, in the room or in a thread", async () => {
        const policy = await build()
        const line = agentTurnViewOf({ source: "tag", context: { messageId: "msg-1", threadId: "th-1" } })

        expect(policy.tagFileRefOf(line)).toEqual({
            workspaceId: "ws-1",
            kind: "tag",
            conversationId: null,
            messageId: "msg-1",
            threadId: "th-1",
        })
        expect(policy.tagFileRefOf(agentTurnViewOf({ source: "tag" }))).toMatchObject({
            messageId: null,
            threadId: null,
        })
    })
})
