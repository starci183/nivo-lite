import {
    contractSchema,
    doorInputSchema,
    planRowSchema,
    readInputSchema,
    readResultSchema,
    readingRowSchema,
    settledRowSchema,
    requestDoorInputSchema,
    tagDoorResultSchema,
    traceRowSchema,
    turnRowSchema,
    wakeRowSchema,
} from "./intent-step.schema"
import { TURN_TEXT_MAX } from "./intent-turn.policy"

const contract = {
    intent: "reply_customer",
    label: "Reply",
    ownTurn: false,
    task: "Answer the customer",
    limits: ["Never promise a price"],
    result: "customer_reply",
    owns: [],
    checks: ["reply_present"],
}

const plan = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    pinned: null,
    contracts: [contract],
}

const trace = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    offered: ["reply_customer"],
    intent: "reply_customer",
    result: "picked",
    detail: "",
    dropped: [],
}

const wake = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    scopeKey: "conversation:conv-1",
    wakeId: "wake-1",
    turnId: "turn-1",
    source: "customer",
    eventKey: "msg-1",
    context: { conversationId: "conv-1", lookupName: true },
    actorMemberId: null,
    attempts: 1,
    maxAttempts: 2,
    wakeCreatedAt: "2026-11-01T10:00:00.000Z",
}

describe("intent step schema > contracts and plans", () => {
    it("accepts a contract and a plan as a row keeps them", () => {
        expect(contractSchema.safeParse(contract).success).toBe(true)
        expect(planRowSchema.safeParse(plan).success).toBe(true)
    })

    it("refuses a contract with a member the shape does not know", () => {
        expect(contractSchema.safeParse({ ...contract, extra: 1 }).success).toBe(false)
        expect(contractSchema.safeParse({ ...contract, risk: "huge" }).success).toBe(false)
    })

    it("bounds the text of a turn", () => {
        expect(turnRowSchema.safeParse({ text: "x".repeat(TURN_TEXT_MAX) }).success).toBe(true)
        expect(turnRowSchema.safeParse({ text: "x".repeat(TURN_TEXT_MAX + 1) }).success).toBe(false)
        expect(readInputSchema.safeParse({ plan, text: "hello" }).success).toBe(true)
    })

    it("keeps custom event identities bounded without granting them a published contract", () => {
        expect(planRowSchema.safeParse({ ...plan, trigger: "invoice.paid" }).success).toBe(true)
        expect(planRowSchema.safeParse({ ...plan, trigger: "invoice paid" }).success).toBe(false)
        expect(planRowSchema.safeParse({ ...plan, trigger: "x".repeat(81) }).success).toBe(false)
        expect(planRowSchema.safeParse({ ...plan, trigger: "" }).success).toBe(false)
    })
})

describe("intent step schema > readings", () => {
    it("accepts the three readings", () => {
        const picked = { kind: "picked", contract, resultText: "{}", dropped: ["order"] }
        const split = { kind: "split", contract }
        const safe = {
            kind: "safe",
            cause: "no_intent",
            detail: "none",
            intent: null,
            gap: { question: "q", topic: "t" },
            draft: "",
        }

        expect(readingRowSchema.safeParse(picked).success).toBe(true)
        expect(readingRowSchema.safeParse(split).success).toBe(true)
        expect(readingRowSchema.safeParse(safe).success).toBe(true)
        expect(readResultSchema.safeParse({ reading: split, trace }).success).toBe(true)
    })

    it("refuses a reading of an unknown kind and a result longer than a row holds", () => {
        const resultText = "x".repeat(40_001)

        expect(readingRowSchema.safeParse({ kind: "other" }).success).toBe(false)
        expect(readingRowSchema.safeParse({ kind: "picked", contract, resultText, dropped: [] }).success).toBe(false)
    })

    it("refuses a trace whose result is not one of the readings", () => {
        expect(traceRowSchema.safeParse(trace).success).toBe(true)
        expect(traceRowSchema.safeParse({ ...trace, result: "done" }).success).toBe(false)
    })
})

describe("intent step schema > the wake of a door", () => {
    it("accepts the wake, the reading and the trace a door needs", () => {
        const input = { wake, reading: { kind: "split", contract }, trace }

        expect(wakeRowSchema.safeParse(wake).success).toBe(true)
        expect(doorInputSchema.safeParse(input).success).toBe(true)
    })

    it("omits an absent inbound member from decoded wakes while retaining the strict actor and source fields", () => {
        for (const input of [wake, { ...wake, inbound: undefined }]) {
            const parsed = wakeRowSchema.parse(input)
            expect(Object.hasOwn(parsed, "inbound")).toBe(false)
            expect(parsed).toEqual(wake)
        }
        const inbound = {
            eventType: "invoice.paid",
            actor: { kind: "webhook", id: "endpoint-1", role: null },
            trust: "outsider",
            chain: null,
            payload: { amount: 120 },
            attachments: [],
            evidence: [],
        }
        expect(wakeRowSchema.parse({ ...wake, inbound })).toEqual({ ...wake, inbound })
        expect(wakeRowSchema.safeParse({ ...wake, inbound: null }).success).toBe(false)
    })

    it("refuses a wake context with more members than a context has", () => {
        const context = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${String(index)}`, "v"]))

        expect(wakeRowSchema.safeParse({ ...wake, context }).success).toBe(false)
    })

    it("keeps a registered custom source as data and refuses malformed source identities", () => {
        expect(wakeRowSchema.safeParse({ ...wake, source: "generic_webhook" }).success).toBe(true)
        expect(wakeRowSchema.safeParse({ ...wake, source: "" }).success).toBe(false)
        expect(wakeRowSchema.safeParse({ ...wake, source: "unbounded source" }).success).toBe(false)
        expect(wakeRowSchema.safeParse({ ...wake, source: "x".repeat(81) }).success).toBe(false)
    })
})

describe("intent step schema > the tag door", () => {
    const settle = { module: "accounting", actorName: "Lan", locale: "vi", installationId: null }

    it("accepts the settle input a tag door applies the proposal under", () => {
        const input = { wake, reading: { kind: "split", contract }, trace, settle }

        expect(requestDoorInputSchema.safeParse(input).success).toBe(true)
        expect(requestDoorInputSchema.safeParse({ ...input, settle: { ...settle, locale: "fr" } }).success).toBe(false)
    })

    it("accepts a proposal as it was applied, an action that was requested and one that was dropped", () => {
        const settled = {
            reply: "On it.",
            needsHuman: false,
            reason: "",
            tasks: 1,
            actions: [
                { index: 0, action: "send_invoice", outcome: "requested", workItemId: "item-1" },
                { index: 1, action: "other", outcome: "dropped", reason: "unknown_action" },
            ],
        }

        expect(settledRowSchema.safeParse(settled).success).toBe(true)
        expect(tagDoorResultSchema.safeParse({ split: false, settled }).success).toBe(true)
        expect(tagDoorResultSchema.safeParse({ split: true, fired: true }).success).toBe(true)
        expect(tagDoorResultSchema.safeParse({ split: true }).success).toBe(false)
    })
})
