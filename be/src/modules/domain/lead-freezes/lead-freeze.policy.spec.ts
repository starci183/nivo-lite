import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { frozenFreezeOf, pendingLineOf } from "@tests/fixtures/builders/lead-freezes.builder"
import * as policy from "./lead-freeze.policy"
import type { HeldWake } from "./lead-freeze.policy"

const SUBJECT = Symbol("lead-freeze.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: subject }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

const WAKE: HeldWake = {
    wakeId: "wake-2",
    agentId: "chatbot",
    source: "trigger",
    eventKey: "msg-2",
    scopeKey: "conversation:c-1",
    context: { conversationId: "c-1", messageId: "m-2", lookupName: false, nested: { no: 1 } },
    actorMemberId: null,
}

describe("lead-freeze.policy: who a wake is about: the customer and the workflow", () => {
    it("names the lead first, then the conversation, and nothing for a trigger that names neither", async () => {
        const { keysOf, contactSubjectOf, subjectOfTrigger } = await buildPolicy()
        expect(subjectOfTrigger({ contactId: "lead-1", conversationId: "c-1" })).toEqual({
            key: "contact:lead-1",
            contactId: "lead-1",
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ conversationId: "c-1" })).toEqual({
            key: "conversation:c-1",
            contactId: null,
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ contactId: "", subject: "bank-transaction:tx-1" })).toBeNull()
        expect(contactSubjectOf("lead-2", null)).toEqual({
            key: "contact:lead-2",
            contactId: "lead-2",
            conversationId: null,
        })
        expect(keysOf({ contactId: "lead-1", conversationId: "c-1" })).toEqual(["contact:lead-1", "conversation:c-1"])
        expect(keysOf({})).toEqual([])
    })

    it("keys a freeze by the workflow its trigger names, so a customer is frozen one workflow at a time", async () => {
        const { keysOf, contactSubjectOf, subjectOfTrigger, workflowOfKey, workflowOfTrigger } = await buildPolicy()
        const trigger = { contactId: "lead-1", conversationId: "c-1", workflowId: "wf-consult" }

        expect(subjectOfTrigger(trigger)).toEqual({
            key: "contact:lead-1|wf:wf-consult",
            contactId: "lead-1",
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ conversationId: "c-1", workflowId: "wf-desk" })?.key).toBe(
            "conversation:c-1|wf:wf-desk",
        )
        expect(contactSubjectOf("lead-2", "c-2", "wf-consult").key).toBe("contact:lead-2|wf:wf-consult")
        expect(contactSubjectOf("lead-2", "c-2", null).key).toBe("contact:lead-2")
        // The workflow's own keys come first, then the bare ones of a freeze that holds the customer as a whole.
        expect(keysOf(trigger)).toEqual([
            "contact:lead-1|wf:wf-consult",
            "conversation:c-1|wf:wf-consult",
            "contact:lead-1",
            "conversation:c-1",
        ])
        expect(workflowOfTrigger(trigger)).toBe("wf-consult")
        expect(workflowOfTrigger({ contactId: "lead-1", workflowId: "" })).toBeNull()
        expect(workflowOfKey("contact:lead-1|wf:wf-consult")).toBe("wf-consult")
        expect(workflowOfKey("contact:lead-1")).toBeNull()
    })
})

describe("lead-freeze.policy: who a wake is about: what a wake carries", () => {
    it("reads the bank transaction of a bank-feed tag, as a label or as the subject of the flows", async () => {
        const { transactionOf } = await buildPolicy()
        expect(transactionOf({ subject: "bank-transaction:tx-1" })).toBe("tx-1")
        expect(transactionOf({ subject: { kind: "bank-transaction", id: "tx-2" } })).toBe("tx-2")
        expect(transactionOf({ subject: { kind: "order", id: "o-1" } })).toBeNull()
        expect(transactionOf({ subject: "nolabel" })).toBeNull()
        expect(transactionOf({ subject: 3 })).toBeNull()
    })

    it("reads the credit a wake names (subject or `transactionId`) as a payment event", async () => {
        const { creditOf, pendingKindOf } = await buildPolicy()
        expect(creditOf({ subject: "bank-transaction:tx-1", transactionId: "tx-9" })).toBe("tx-1")
        expect(creditOf({ transactionId: "tx-2" })).toBe("tx-2")
        expect(creditOf({ transactionId: "" })).toBeNull()
        expect(pendingKindOf("tag", { transactionId: "tx-2" })).toBe("payment")
    })

    it("tells a line, a payment, a timer, a hand-off and any other event apart", async () => {
        const { pendingKindOf } = await buildPolicy()
        // A person's line of the one pipeline: source `trigger`, told apart by the channel identity its event is about.
        expect(pendingKindOf("trigger", { routeId: "route-1", subject: { channel: "zalo", id: "u-1" }, data: { text: "alo" } })).toBe("message")
        expect(pendingKindOf("trigger", { eventId: "render-1", data: { renderId: "r-1" } })).toBe("event")
        expect(pendingKindOf("tag", { subject: "bank-transaction:tx-1" })).toBe("payment")
        expect(pendingKindOf("schedule", {})).toBe("timer")
        expect(pendingKindOf("internal", { taskId: "t-1" })).toBe("timer")
        expect(pendingKindOf("tag", {})).toBe("handoff")
        expect(pendingKindOf("internal", {})).toBe("event")
    })

    it("reads the messages a trigger carries, from the ids of the flows or from the wake's own", async () => {
        const { messageIdsOf } = await buildPolicy()
        expect(messageIdsOf({ messageIds: ["m-1", 2, "m-2"] })).toEqual(["m-1", "m-2"])
        expect(messageIdsOf({ messageId: "m-1" })).toEqual(["m-1"])
        expect(messageIdsOf({})).toEqual([])
    })
})

describe("lead-freeze.policy: the pending events", () => {
    it("keeps a held wake with its texts and flags only, and a line with its conversation and messages", async () => {
        const { pendingEventOf } = await buildPolicy()
        expect(
            pendingEventOf(
                WAKE,
                { conversationId: "c-1", messageIds: ["m-2"], subject: { channel: "zalo", id: "u-1" } },
                "2026-11-04T10:01:00.000Z",
            ),
        ).toEqual({
            ...pendingLineOf(),
            context: { conversationId: "c-1", messageId: "m-2", lookupName: false },
            // The trigger scope as the flow formed it: what a run the event joins reads (`ctx.run.joined`).
            trigger: { conversationId: "c-1", messageIds: ["m-2"], subject: { channel: "zalo", id: "u-1" } },
        })
        const payment = pendingEventOf({ ...WAKE, source: "tag" }, { subject: "bank-transaction:tx-1" }, "t")
        expect(payment).toMatchObject({ kind: "payment", conversationId: null, messageIds: [] })
    })

    it("records a wake once, in order, and past the bound drops the oldest line a retry already showed", async () => {
        const { PENDING_MAX, withPending } = await buildPolicy()
        const one = withPending([], pendingLineOf())
        expect(withPending(one, pendingLineOf())).toBe(one)
        const two = withPending(one, pendingLineOf({ wakeId: "wake-3" }))
        expect(two.map((each) => each.wakeId)).toEqual(["wake-2", "wake-3"])
        const full = Array.from({ length: PENDING_MAX }, (_, at) =>
            pendingLineOf({ wakeId: `w-${at}`, folded: at === 1 }),
        )
        const next = withPending(full, pendingLineOf({ wakeId: "w-new" }))
        expect(next).toHaveLength(PENDING_MAX)
        expect(next.some((each) => each.wakeId === "w-1")).toBe(false)
        expect(next.at(-1)?.wakeId).toBe("w-new")
        const unfolded = Array.from({ length: PENDING_MAX }, (_, at) => pendingLineOf({ wakeId: `u-${at}` }))
        expect(withPending(unfolded, pendingLineOf({ wakeId: "u-new" }))).toHaveLength(PENDING_MAX + 1)
    })

    it("an event a step of the run took into its queue snapshot is the run's work; an untaken one is replayed (ROAD-API section 4)", async () => {
        const { takenByRun, withTaken } = await buildPolicy()
        const early = pendingLineOf({ wakeId: "early", at: "2026-11-04T10:01:00.000Z" })
        const late = pendingLineOf({ wakeId: "late", at: "2026-11-04T10:09:00.000Z" })
        expect(takenByRun([early, late])).toEqual([])
        const marked = withTaken([early, late], new Set(["early"]), "run-1:answer:1")
        expect(takenByRun(marked).map((one) => one.wakeId)).toEqual(["early"])
        expect(marked.find((one) => one.wakeId === "early")?.taken).toBe("run-1:answer:1")
        // A second visit never takes an event another visit took: the first mark stands.
        const again = withTaken(marked, new Set(["early", "late"]), "run-1:answer:2")
        expect(again.map((one) => one.taken)).toEqual(["run-1:answer:1", "run-1:answer:2"])
    })

    it("writes a replayed wake under its own key marked with the hold and its episode", async () => {
        const { replayKeyOf } = await buildPolicy()
        expect(replayKeyOf(pendingLineOf(), "freeze-1", 2)).toBe("msg-2~after-freeze-freeze-1-2")
    })
})

describe("lead-freeze.policy: what the owner reads", () => {
    it("answers the state of a freeze that holds its customer, and nothing for one released", async () => {
        const { holds, stateOf } = await buildPolicy()
        const freeze = frozenFreezeOf({ pending: [pendingLineOf(), pendingLineOf({ wakeId: "f", folded: true })] })
        expect(holds(null)).toBe(false)
        expect(holds({ ...freeze, status: "released" })).toBe(false)
        expect(stateOf({ ...freeze, status: "released" })).toBeNull()
        expect(stateOf(freeze)).toEqual({
            id: "freeze-1",
            status: "frozen",
            workflowId: null,
            contactId: "lead-1",
            conversationId: "c-1",
            runId: "run-1",
            stepTitle: "Take a payment claim",
            reason: "GRAPH_NODES_EXECUTOR_MISSING",
            workItemId: "item-1",
            pendingCount: 1,
            heldBy: null,
            frozenAt: "2026-11-04T10:00:00.000Z",
            onStop: false,
        })
        expect(stateOf({ ...freeze, key: "contact:lead-1|wf:wf-consult" })?.workflowId).toBe("wf-consult")
        expect(stateOf({ ...freeze, frozenReason: "run_stop", workItemId: null })?.onStop).toBe(true)
    })
})
