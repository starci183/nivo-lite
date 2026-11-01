import { Test } from "@nestjs/testing"
import type { BridgeTurn } from "@modules/domain/agent-tools"
import type { IntentContract, IntentReading } from "@modules/domain/intent-contracts"
import type { IntentPlan, IntentReadingRow } from "./agent-turns.contracts"
import {
    doorNodeOf,
    intentScopeOf,
    offeredOf,
    pinnedOf,
    readingRowOf,
    splitEventKeyOf,
    tagAudienceOf,
    traceOf,
    triggerOf,
    writesOf,
} from "./intent-turn.policy"

const SUBJECT = Symbol("intent-turn.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    doorNodeOf,
                    intentScopeOf,
                    offeredOf,
                    pinnedOf,
                    readingRowOf,
                    splitEventKeyOf,
                    tagAudienceOf,
                    traceOf,
                    triggerOf,
                    writesOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        doorNodeOf: typeof doorNodeOf
        intentScopeOf: typeof intentScopeOf
        offeredOf: typeof offeredOf
        pinnedOf: typeof pinnedOf
        readingRowOf: typeof readingRowOf
        splitEventKeyOf: typeof splitEventKeyOf
        tagAudienceOf: typeof tagAudienceOf
        traceOf: typeof traceOf
        triggerOf: typeof triggerOf
        writesOf: typeof writesOf
    }>(SUBJECT)
}

const contract = (intent: string): IntentContract => ({
    intent,
    label: intent,
    risk: "none",
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
})

const plan: IntentPlan = {
    versionId: "v-1",
    trigger: "customer_message",
    audience: "customer",
    pinned: null,
    contracts: [contract("reply_customer"), contract("confirm_order")],
}

describe("intent turn policy > what starts a turn", () => {
    it("maps a customer wake and a tag wake to their trigger, and nothing else", async () => {
        const policy = await build()

        expect(policy.triggerOf("customer")).toBe("customer_message")
        expect(policy.triggerOf("tag")).toBe("tag")
        expect(policy.triggerOf("internal")).toBeNull()
        expect(policy.triggerOf("schedule")).toBeNull()
    })

    it("reads the pin from the wake, which only a split writes", async () => {
        const policy = await build()

        expect(policy.pinnedOf({})).toBeNull()
        expect(policy.pinnedOf({ intent: "confirm_order" })).toBe("confirm_order")
    })

    it("keys the follow-up of a split by the wake and the intent", async () => {
        const policy = await build()

        expect(policy.splitEventKeyOf("wake-1", "confirm_order")).toBe("intent:wake-1:confirm_order")
    })

    it("makes the audience of a tag a manager when its author may write, else staff", async () => {
        const policy = await build()

        expect(policy.tagAudienceOf(true)).toBe("manager")
        expect(policy.tagAudienceOf(false)).toBe("staff")
    })

    it("treats every scope but read as a write", async () => {
        const policy = await build()

        expect(policy.writesOf("read")).toBe(false)
        expect(policy.writesOf("write")).toBe(true)
        expect(policy.writesOf("money")).toBe(true)
    })
})

describe("intent turn policy > the contracts a turn is offered", () => {
    const all = { versionId: "v-1", contracts: plan.contracts }

    it("offers all of them on a first turn", async () => {
        const policy = await build()

        expect(policy.offeredOf(all, null)).toEqual(plan.contracts)
    })

    it("offers only the pinned one on a follow-up, and none when the graph dropped it", async () => {
        const policy = await build()

        expect(policy.offeredOf(all, "confirm_order").map((item) => item.intent)).toEqual(["confirm_order"])
        expect(policy.offeredOf(all, "gone")).toEqual([])
    })
})

describe("intent turn policy > the trace", () => {
    it("traces a picked intent with the members it dropped", async () => {
        const policy = await build()
        const reading: IntentReading = {
            kind: "picked",
            contract: contract("reply_customer"),
            result: {},
            dropped: ["order"],
        }

        expect(policy.traceOf(plan, reading)).toEqual({
            versionId: "v-1",
            trigger: "customer_message",
            audience: "customer",
            offered: ["reply_customer", "confirm_order"],
            intent: "reply_customer",
            result: "picked",
            detail: "",
            dropped: ["order"],
        })
    })

    it("traces a split with the intent that runs alone", async () => {
        const policy = await build()
        const reading: IntentReading = { kind: "split", contract: contract("confirm_order") }

        expect(policy.traceOf(plan, reading)).toMatchObject({ intent: "confirm_order", result: "split", dropped: [] })
    })

    it("traces the safe road with its cause and the code of what failed", async () => {
        const policy = await build()
        const reading: IntentReading = {
            kind: "safe",
            cause: "check_failed",
            detail: "reply_present",
            intent: "reply_customer",
            gap: null,
            draft: "",
        }

        expect(policy.traceOf(plan, reading)).toMatchObject({
            intent: "reply_customer",
            result: "check_failed",
            detail: "reply_present",
        })
    })
})

describe("intent turn policy > the reading as a row keeps it", () => {
    it("keeps the result of a picked intent as the JSON text a door reads", async () => {
        const policy = await build()
        const reading: IntentReading = {
            kind: "picked",
            contract: contract("reply_customer"),
            result: { reply: "50k" },
            dropped: ["order"],
        }

        expect(policy.readingRowOf(reading)).toEqual({
            kind: "picked",
            contract: contract("reply_customer"),
            resultText: '{"reply":"50k"}',
            dropped: ["order"],
        })
    })

    it("keeps a split and the safe road as they are", async () => {
        const policy = await build()
        const split: IntentReading = { kind: "split", contract: contract("confirm_order") }
        const safe: IntentReading = {
            kind: "safe",
            cause: "no_intent",
            detail: "none",
            intent: null,
            gap: null,
            draft: "",
        }

        expect(policy.readingRowOf(split)).toEqual(split)
        expect(policy.readingRowOf(safe)).toEqual(safe)
    })
})

describe("intent turn policy > the scope of a bridge turn", () => {
    const base: BridgeTurn = {
        jobId: "wake-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        turnId: "turn-1",
        wakeId: "wake-1",
        source: "tag",
        conversationId: null,
        authorUserId: "user-1",
    }

    it("takes the scope from the turn row, with no pin when the turn carries none", async () => {
        const policy = await build()

        expect(policy.intentScopeOf(base)).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "tag",
            authorUserId: "user-1",
            pinned: null,
        })
    })

    it("carries the pin of a follow-up turn", async () => {
        const policy = await build()

        expect(policy.intentScopeOf({ ...base, pinnedIntent: "confirm_order" }).pinned).toBe("confirm_order")
    })
})

describe("intent turn policy > the node of the door", () => {
    const keys = { turn: "understand", acts: { confirm_order: "confirm" } }
    const picked: IntentReadingRow = {
        kind: "picked",
        contract: contract("confirm_order"),
        resultText: "{}",
        dropped: [],
    }

    it("is the act node of the intent the reading picked", async () => {
        const policy = await build()

        expect(policy.doorNodeOf(keys, picked)).toBe("confirm")
        expect(policy.doorNodeOf(keys, { kind: "split", contract: contract("confirm_order") })).toBe("confirm")
    })

    it("is the node where the turn picks for an intent the graph has no act node for, and for the safe road with none", async () => {
        const policy = await build()
        const safe: IntentReadingRow = {
            kind: "safe",
            cause: "no_intent",
            detail: "none",
            intent: null,
            gap: null,
            draft: "",
        }

        expect(policy.doorNodeOf(keys, { ...picked, contract: contract("reply_customer") })).toBe("understand")
        expect(policy.doorNodeOf(keys, safe)).toBe("understand")
        expect(policy.doorNodeOf(keys, { ...safe, intent: "confirm_order" })).toBe("confirm")
    })
})
