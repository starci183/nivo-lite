import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { freezeWordsOf, frozenFreezeOf, pendingLineOf } from "@tests/fixtures/builders/lead-freezes.builder"
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
    source: "customer",
    eventKey: "msg-2",
    scopeKey: "conversation:c-1",
    context: { conversationId: "c-1", messageId: "m-2", lookupName: false, nested: { no: 1 } },
    actorMemberId: null,
}

const EN = freezeWordsOf("en")

describe("lead-freeze.policy: who a wake is about", () => {
    it("names the lead first, then the conversation, and nothing for a trigger that names neither", async () => {
        const { keysOf, leadSubjectOf, subjectOfTrigger } = await buildPolicy()
        expect(subjectOfTrigger({ leadId: "lead-1", conversationId: "c-1" })).toEqual({
            key: "lead:lead-1",
            leadId: "lead-1",
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ conversationId: "c-1" })).toEqual({
            key: "conversation:c-1",
            leadId: null,
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ leadId: "", subject: "bank-transaction:tx-1" })).toBeNull()
        expect(leadSubjectOf("lead-2", null)).toEqual({ key: "lead:lead-2", leadId: "lead-2", conversationId: null })
        expect(keysOf({ leadId: "lead-1", conversationId: "c-1" })).toEqual(["lead:lead-1", "conversation:c-1"])
        expect(keysOf({})).toEqual([])
    })

    it("keys a freeze by the workflow its trigger names, so a customer is frozen one workflow at a time", async () => {
        const { keysOf, leadSubjectOf, subjectOfTrigger, workflowOfKey, workflowOfTrigger } = await buildPolicy()
        const trigger = { leadId: "lead-1", conversationId: "c-1", workflowId: "wf-consult" }

        expect(subjectOfTrigger(trigger)).toEqual({
            key: "lead:lead-1|wf:wf-consult",
            leadId: "lead-1",
            conversationId: "c-1",
        })
        expect(subjectOfTrigger({ conversationId: "c-1", workflowId: "wf-desk" })?.key).toBe("conversation:c-1|wf:wf-desk")
        expect(leadSubjectOf("lead-2", "c-2", "wf-consult").key).toBe("lead:lead-2|wf:wf-consult")
        expect(leadSubjectOf("lead-2", "c-2", null).key).toBe("lead:lead-2")
        // The workflow's own keys come first, then the bare ones of a freeze that holds the customer as a whole.
        expect(keysOf(trigger)).toEqual([
            "lead:lead-1|wf:wf-consult",
            "conversation:c-1|wf:wf-consult",
            "lead:lead-1",
            "conversation:c-1",
        ])
        expect(workflowOfTrigger(trigger)).toBe("wf-consult")
        expect(workflowOfTrigger({ leadId: "lead-1", workflowId: "" })).toBeNull()
        expect(workflowOfKey("lead:lead-1|wf:wf-consult")).toBe("wf-consult")
        expect(workflowOfKey("lead:lead-1")).toBeNull()
    })

    it("holds only the wakes of the workflow a freeze names, and every wake when it holds the customer as a whole", async () => {
        const { holdsWorkflow } = await buildPolicy()
        const ofConsult = frozenFreezeOf({ key: "lead:lead-1|wf:wf-consult" })
        const whole = frozenFreezeOf({ key: "lead:lead-1" })

        expect(holdsWorkflow(ofConsult, "wf-consult")).toBe(true)
        expect(holdsWorkflow(ofConsult, "wf-reconcile")).toBe(false)
        expect(holdsWorkflow(ofConsult, null)).toBe(false)
        expect(holdsWorkflow(whole, "wf-reconcile")).toBe(true)
        expect(holdsWorkflow(whole, null)).toBe(true)
    })

    it("reads the bank transaction of a bank-feed tag, as a label or as the subject of the flows", async () => {
        const { transactionOf } = await buildPolicy()
        expect(transactionOf({ subject: "bank-transaction:tx-1" })).toBe("tx-1")
        expect(transactionOf({ subject: { kind: "bank-transaction", id: "tx-2" } })).toBe("tx-2")
        expect(transactionOf({ subject: { kind: "order", id: "o-1" } })).toBeNull()
        expect(transactionOf({ subject: "nolabel" })).toBeNull()
        expect(transactionOf({ subject: 3 })).toBeNull()
    })

    it("tells a line, a payment, a timer, a hand-off and any other event apart", async () => {
        const { pendingKindOf } = await buildPolicy()
        expect(pendingKindOf("customer", {})).toBe("message")
        expect(pendingKindOf("tag", { subject: "bank-transaction:tx-1" })).toBe("payment")
        expect(pendingKindOf("tag", { tagSource: "bank_feed" })).toBe("payment")
        expect(pendingKindOf("schedule", {})).toBe("timer")
        expect(pendingKindOf("internal", { taskId: "t-1" })).toBe("timer")
        expect(pendingKindOf("tag", {})).toBe("handoff")
        expect(pendingKindOf("internal", {})).toBe("event")
    })

    it("reads the messages a trigger carries, from the ids of the flows or from the wake's own", async () => {
        const { messageIdsOf } = await buildPolicy()
        expect(messageIdsOf({ messageIds: ["m-1", 2, "m-2"] })).toEqual(["m-1", "m-2"])
        expect(messageIdsOf({ messageId: "m-1", mergedMessageIds: "m-2,m-3" })).toEqual(["m-1", "m-2", "m-3"])
        expect(messageIdsOf({})).toEqual([])
    })
})

describe("lead-freeze.policy: the pending events", () => {
    it("keeps a held wake with its texts and flags only, and a line with its conversation and messages", async () => {
        const { pendingEventOf } = await buildPolicy()
        expect(
            pendingEventOf(WAKE, { conversationId: "c-1", messageIds: ["m-2"] }, "2026-11-04T10:01:00.000Z"),
        ).toEqual({
            ...pendingLineOf(),
            context: { conversationId: "c-1", messageId: "m-2", lookupName: false },
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

    it("folds the lines of the run's conversation into a retry, and replays only what the retry did not answer", async () => {
        const { foldLines, linesToFold, replayKeyOf, replayOf } = await buildPolicy()
        const pending = [
            pendingLineOf(),
            pendingLineOf({ wakeId: "w-pay", kind: "payment", conversationId: null, messageIds: [] }),
            pendingLineOf({ wakeId: "w-other", conversationId: "c-2", messageIds: ["m-9"] }),
        ]
        expect(linesToFold(pending, "c-1")).toEqual(["m-2"])
        expect(linesToFold(pending, null)).toEqual([])
        const folded = foldLines(pending, "c-1")
        expect(folded.map((each) => each.folded)).toEqual([true, false, false])
        expect(foldLines(pending, null)).toEqual(pending)
        expect(replayOf(folded, "retried").map((each) => each.wakeId)).toEqual(["w-pay", "w-other"])
        expect(replayOf(folded, "skipped").map((each) => each.wakeId)).toEqual(["wake-2", "w-pay", "w-other"])
        expect(replayKeyOf(pendingLineOf(), "freeze-1", 2)).toBe("msg-2~after-freeze-freeze-1-2")
    })
})

describe("lead-freeze.policy: the newest lines of a retry", () => {
    const INPUT = {
        versionId: "v-1",
        trigger: { text: "paid", messages: [{ id: "m-1", text: "paid" }], messageIds: ["m-1"] },
    }
    const FILE = { id: "f", name: "n", contentType: "image/png", url: "u" }
    const LINE = { id: "m-2", text: "please check", at: "t", attachments: [FILE] }

    it("adds the lines the trigger does not hold yet, oldest first, to its text, messages and ids", async () => {
        const { withLines } = await buildPolicy()
        expect(withLines(INPUT, [LINE, { ...LINE, id: "m-1" }])).toEqual({
            versionId: "v-1",
            trigger: {
                text: "paid\nplease check",
                messages: [{ id: "m-1", text: "paid" }, LINE],
                messageIds: ["m-1", "m-2"],
            },
        })
    })

    it("leaves an input with no trigger, no new line or nothing said as it is", async () => {
        const { withLines } = await buildPolicy()
        expect(withLines({ versionId: "v-1" }, [LINE])).toEqual({ versionId: "v-1" })
        expect(withLines(INPUT, [])).toBe(INPUT)
        expect(withLines(INPUT, [{ ...LINE, id: "m-1" }])).toBe(INPUT)
        expect(withLines({ trigger: {} }, [LINE])).toEqual({
            trigger: { text: "please check", messages: [LINE], messageIds: ["m-2"] },
        })
    })
})

describe("lead-freeze.policy: what the owner reads", () => {
    it("titles the step in the owner's language, else by its key", async () => {
        const { localeOf, stepTitleOf } = await buildPolicy()
        expect(stepTitleOf({ vi: "claim (vi)", en: "Take a payment claim" }, "claim-ack", "en")).toBe(
            "Take a payment claim",
        )
        expect(stepTitleOf({ vi: "claim (vi)", en: "" }, "claim-ack", "en")).toBe("claim (vi)")
        expect(stepTitleOf({ key: "x" }, "claim-ack", "vi")).toBe("claim-ack")
        expect(stepTitleOf(undefined, "claim-ack", "vi")).toBe("claim-ack")
        expect(localeOf({ locale: "en" })).toBe("en")
        expect(localeOf({})).toBe("vi")
    })

    it("words the error codes the owner meets, and names any other as it is", async () => {
        const { errorSummaryOf } = await buildPolicy()
        expect(errorSummaryOf("GRAPH_NODES_EXECUTOR_MISSING", EN)).toBe("the step has no executor")
        expect(errorSummaryOf("SOMETHING_ELSE", EN)).toBe("SOMETHING_ELSE")
        expect(errorSummaryOf(null, EN)).toBe("unknown")
    })

    it("says who waits, at which step, why, how many events wait and what each answer will do", async () => {
        const { itemAnswersOf, itemSummaryOf, itemTitleOf } = await buildPolicy()
        const freeze = frozenFreezeOf()
        expect(itemTitleOf(freeze, EN)).toBe(
            "Customer Nguyen Van A is waiting for you: the step Take a payment claim failed",
        )
        const pending = [pendingLineOf(), pendingLineOf({ wakeId: "x", folded: true })]
        const summary = itemSummaryOf({ ...freeze, failures: 2, pending }, EN)
        expect(summary).toContain("Error: the step has no executor.")
        expect(summary).toContain("Failed 2 times.")
        expect(summary).toContain("1 events are waiting")
        expect(summary).toContain("Retry:")
        expect(summary).toContain("Take over:")
        expect(summary).toContain("Skip this turn:")
        expect(itemTitleOf({ ...freeze, customerName: null, stepTitle: null }, EN)).toBe(
            "Customer without a name is waiting for you: the step claim-ack failed",
        )
        expect(itemTitleOf({ ...freeze, stepKey: null, stepTitle: null }, EN)).toContain("the step ? failed")
        expect(itemSummaryOf(freeze, EN)).toContain("No event is waiting yet.")
        expect(Object.keys(itemAnswersOf(EN))).toEqual(["retry", "takeOver", "skip"])
    })

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
            leadId: "lead-1",
            conversationId: "c-1",
            runId: "run-1",
            stepTitle: "Take a payment claim",
            reason: "GRAPH_NODES_EXECUTOR_MISSING",
            workItemId: "item-1",
            pendingCount: 1,
            heldBy: null,
            frozenAt: "2026-11-04T10:00:00.000Z",
        })
        expect(stateOf({ ...freeze, key: "lead:lead-1|wf:wf-consult" })?.workflowId).toBe("wf-consult")
    })

    it("matches a transfer to an order by its transfer code, whatever the spacing and case", async () => {
        const { namesAnOrder } = await buildPolicy()
        expect(namesAnOrder("dh202611090001 NGUYEN VAN A", ["DH-20261109-0001"])).toBe(true)
        expect(namesAnOrder("DH 2026 1109 0001", ["DH-20261109-0001"])).toBe(true)
        expect(namesAnOrder("DH202611090002", ["DH-20261109-0001"])).toBe(false)
        expect(namesAnOrder(null, ["DH-20261109-0001"])).toBe(false)
        expect(namesAnOrder("anything", ["--"])).toBe(false)
    })
})
