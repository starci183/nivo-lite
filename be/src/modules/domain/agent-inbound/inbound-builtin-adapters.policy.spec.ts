import { Test } from "@nestjs/testing"
import { wakeSources } from "@modules/domain/agent-work"
import { wakeTraitsOf } from "./inbound-adapter.policy"
import { NO_DOOR, builtInAdapters } from "./inbound-builtin-adapters.policy"

const SUBJECT = Symbol("inbound-builtin-adapters.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { builtInAdapters } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-builtin-adapters.policy")>(SUBJECT)
}

/** What the work core gave each of the four sources before adapters existed, in the order customer, tag, internal, schedule. */
const TODAYS_TRAITS = [
    {
        priority: 10,
        maxAttempts: 2,
        scopedToConversation: true,
        background: false,
        restoresHeld: true,
        awaitsAnswer: true,
    },
    {
        priority: 20,
        maxAttempts: 3,
        scopedToConversation: false,
        background: false,
        restoresHeld: true,
        awaitsAnswer: false,
    },
    {
        priority: 30,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
    {
        priority: 40,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
]

const ACTOR = { kind: "member", id: "m-1", role: "staff" }

describe("builtInAdapters", () => {
    it("declares the four sources that existed before adapters, once each", async () => {
        const { builtInAdapters } = await buildSubject()

        expect(builtInAdapters().map((adapter) => adapter.key)).toEqual(["customer", "tag", "internal", "schedule"])
    })

    it("derives for each of them the traits the work core gave it before adapters, which are the traits the core records", async () => {
        const { builtInAdapters } = await buildSubject()
        const adapters = builtInAdapters()

        expect(adapters.map(wakeTraitsOf)).toEqual(TODAYS_TRAITS)
        expect(adapters.map((adapter) => wakeSources.of(adapter.key))).toEqual(TODAYS_TRAITS)
    })

    it("trusts a customer as an outsider, the clock and the events of the business as the system, and a tag by who tagged", async () => {
        const { builtInAdapters } = await buildSubject()
        const trust = (actor: typeof ACTOR) => builtInAdapters().map((adapter) => adapter.trustOf(actor))

        expect(trust(ACTOR)).toEqual(["outsider", "member", "system", "system"])
        expect(trust({ ...ACTOR, role: "owner" })).toEqual(["outsider", "manager", "system", "system"])
        expect(trust({ kind: "agent", id: "a-1", role: "" })).toEqual(["outsider", "member", "system", "system"])
    })

    it("gives a customer wake the ids its handler reads and nothing else from the payload", async () => {
        const { builtInAdapters } = await buildSubject()
        const [customer, tag] = builtInAdapters()
        const event = {
            adapter: "customer",
            eventType: "customer_message",
            actor: ACTOR,
            chain: null,
            payload: { conversationId: "c-1", messageId: "m-1", channelEventId: 7, lookupName: true, other: "x" },
            attachments: [],
            evidence: [],
            idempotencyKey: "m-1",
            workspaceId: "ws-1",
            agentId: "a-1",
            scopeKey: null,
        }

        expect(customer?.wakeContextOf?.(event)).toEqual({ conversationId: "c-1", messageId: "m-1", lookupName: true })
        expect(customer?.wakeContextOf?.({ ...event, payload: {} })).toEqual({})
        expect(tag?.wakeContextOf).toBeUndefined()
    })

    it("names the door and the reply of each adapter, and no door for the two that never take the contract pipeline", async () => {
        const { builtInAdapters } = await buildSubject()

        expect(builtInAdapters().map((adapter) => [adapter.doorStep, adapter.replyStep])).toEqual([
            ["door", "final_reply"],
            ["tag_door", null],
            [NO_DOOR, null],
            [NO_DOOR, null],
        ])
    })
})
