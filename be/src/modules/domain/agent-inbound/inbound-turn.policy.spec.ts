import { Test } from "@nestjs/testing"
import type { IntentContract, TurnContracts } from "@modules/domain/intent-contracts"
import {
    EVENT_PART_KIND,
    EVENT_TEXT_MAX,
    trustOfWake,
    eventPartsOf,
    heldBy,
    offeredIn,
    skippedBy,
    triggerOfEvent,
} from "./inbound-turn.policy"

const SUBJECT = Symbol("inbound-turn.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { trustOfWake, eventPartsOf, heldBy, offeredIn, skippedBy, triggerOfEvent },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./inbound-turn.policy")>(SUBJECT)
}

const contract = (intent: string): IntentContract => ({
    intent,
    label: intent,
    ownTurn: false,
    task: "",
    limits: [],
    result: "customer_reply",
    owns: [],
    checks: [],
})

const found: TurnContracts = { versionId: "v-1", contracts: [contract("reply_customer"), contract("confirm_order")] }

describe("triggerOfEvent", () => {
    it("names the trigger step of an event type a contract frame accepts and nothing for any other type", async () => {
        const { triggerOfEvent } = await buildSubject()

        expect(triggerOfEvent("tag")).toBe("tag")
        expect(triggerOfEvent("customer_message")).toBe("customer_message")
        expect(triggerOfEvent("invoice.paid")).toBeNull()
    })
})

describe("trustOfWake", () => {
    it("keeps a trust it knows and reads anything else as an outsider", async () => {
        const { trustOfWake } = await buildSubject()

        expect(trustOfWake("outsider")).toBe("outsider")
        expect(trustOfWake("manager")).toBe("manager")
        expect(trustOfWake("member")).toBe("member")
        expect(trustOfWake("unknown")).toBe("outsider")
    })
})

describe("offeredIn", () => {
    it("offers every contract on a first turn and only the pinned one on a follow-up", async () => {
        const { offeredIn } = await buildSubject()

        expect(offeredIn(found, null).map((c) => c.intent)).toEqual(["reply_customer", "confirm_order"])
        expect(offeredIn(found, "confirm_order").map((c) => c.intent)).toEqual(["confirm_order"])
        expect(offeredIn(found, "dropped_intent")).toEqual([])
    })
})

describe("eventPartsOf", () => {
    const inbound = {
        eventType: "invoice.paid",
        actor: { kind: "webhook", id: null, role: null },
        trust: "outsider",
        chain: null,
        payload: { amount: 1 },
        attachments: [],
        evidence: [],
    }

    it("shows the event type and its payload as one part of data", async () => {
        const { eventPartsOf } = await buildSubject()

        expect(eventPartsOf(inbound)).toEqual([{ kind: EVENT_PART_KIND, text: 'invoice.paid\n{"amount":1}' }])
    })

    it("shows no more than the longest event text", async () => {
        const { eventPartsOf } = await buildSubject()
        const [part] = eventPartsOf({ ...inbound, payload: { text: "x".repeat(EVENT_TEXT_MAX * 2) } })

        expect(part?.text).toHaveLength(EVENT_TEXT_MAX)
    })
})

describe("endings", () => {
    it("skips and holds a wake with the reason on the Work tab and no outcome", async () => {
        const { skippedBy, heldBy } = await buildSubject()

        expect(skippedBy("no_contract")).toEqual({ status: "skipped", reason: "no_contract", outcome: null })
        expect(heldBy("killed")).toEqual({ status: "held", reason: "killed", outcome: null })
    })
})
