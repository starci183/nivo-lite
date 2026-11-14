import type { GraphSpec, WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { pipelineVerbOf, takingTriggerOf, triggerTakes, wakeVerbOf } from "./workflow-trigger.policy"

/** A bank feed's credit registration of one workflow, keyed by one exact `where` on the event's data. */
const creditTrigger = (key: string, direction: string, connectionId: string | null = null): WorkflowTrigger => ({
    key,
    source: { kind: "provider", connectionId, provider: "sepay", trigger: "transaction.received" },
    conditions: [{ param: "data.direction", op: "equals", value: direction }],
})

/** A graph of one registration (the rest of the graph does not take part in routing). */
const graphOf = (trigger: WorkflowTrigger): GraphSpec => ({ triggers: [trigger] }) as unknown as GraphSpec

/** The scope `deliver` routes a credit by: the generic members, the data, and the verb the producer named. */
const creditScope = (direction: string, accountId = "conn-bank"): Readonly<Record<string, unknown>> => ({
    verb: TRIGGER.paymentCreditReceived,
    eventId: `tx-${direction}`,
    accountId,
    data: { transactionId: `tx-${direction}`, direction },
})

describe("workflow-trigger.policy: MATCH of the one event pipeline (by verb, account and `where`, never by road)", () => {
    it("names the verb a pipeline wake carries, whatever its road", () => {
        const scope = creditScope("in")
        expect(pipelineVerbOf(scope)).toBe(TRIGGER.paymentCreditReceived)
        expect(wakeVerbOf("channel", scope)).toBe(TRIGGER.paymentCreditReceived)
        expect(pipelineVerbOf({ verb: "no.such.verb" })).toBeNull()
    })

    it("two registrations on one trigger with disjoint `where` each take only their own events", () => {
        const books = graphOf(creditTrigger("t-in", "in"))
        const refunds = graphOf(creditTrigger("t-out", "out"))

        expect(takingTriggerOf(books, "trigger", creditScope("in"))).toBe("t-in")
        expect(takingTriggerOf(refunds, "trigger", creditScope("in"))).toBeNull()
        expect(takingTriggerOf(refunds, "trigger", creditScope("out"))).toBe("t-out")
        expect(takingTriggerOf(books, "trigger", creditScope("out"))).toBeNull()
    })

    it("a registration of another verb takes nothing; one pinned to an account takes only that account's events", () => {
        const line: WorkflowTrigger = { key: "t-line", source: { kind: "zalo", connectionId: null } }
        expect(triggerTakes(line, "trigger", creditScope("in"))).toBe(false)

        const pinned = creditTrigger("t-in", "in", "conn-bank")
        expect(triggerTakes(pinned, "trigger", creditScope("in", "conn-bank"))).toBe(true)
        expect(triggerTakes(pinned, "trigger", creditScope("in", "conn-other"))).toBe(false)
    })

    it("an account the graph's binding mutes for the verb takes nothing (one source per stream)", () => {
        const trigger = creditTrigger("t-in", "in")
        const binding = {
            sources: [],
            muted: [{ verb: TRIGGER.paymentCreditReceived, connectionId: "conn-bank", provider: "sepay" }],
        } as unknown as Parameters<typeof triggerTakes>[3]

        expect(triggerTakes(trigger, "trigger", creditScope("in"), binding)).toBe(false)
        expect(triggerTakes(trigger, "trigger", creditScope("in", "conn-picked"), binding)).toBe(true)
    })
})
