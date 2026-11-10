import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { frozenFreezeOf, releasedFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { THREAD_STOP_REASON } from "./lead-freeze.policy"
import * as policy from "./lead-freeze-threads.policy"
import type { HeldStop } from "./lead-freezes.contracts"

const SUBJECT = Symbol("lead-freeze-threads.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: subject }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

const STOP: HeldStop = {
    runId: "run-7",
    stepKey: "consult",
    agentId: "chatbot",
    workflowId: "wf-front-desk",
    leadId: "lead-1",
    conversationId: "c-1",
    toldConversationIds: [],
    stoppedAt: "2026-11-10T10:00:00.000Z",
}

describe("lead-freeze-threads.policy: which open stop holds a wake", () => {
    it("tells the hold of a stop from a freeze of the old engine by its reason", async () => {
        const { isThreadHold } = await buildPolicy()
        expect(isThreadHold(frozenFreezeOf({ frozenReason: THREAD_STOP_REASON }))).toBe(true)
        expect(isThreadHold(frozenFreezeOf())).toBe(false)
        expect(isThreadHold(null)).toBe(false)
    })

    it("holds a wake of the stop's own workflow only; a stop of an agent's own graph holds every workflow", async () => {
        const { stopHoldsWorkflow } = await buildPolicy()
        expect(stopHoldsWorkflow(STOP, "wf-front-desk")).toBe(true)
        expect(stopHoldsWorkflow(STOP, "wf-consult")).toBe(false)
        expect(stopHoldsWorkflow(STOP, null)).toBe(false)
        expect(stopHoldsWorkflow({ workflowId: null }, "wf-consult")).toBe(true)
    })

    it("is about the customer by the same lead or the same conversation; a stop with neither holds nobody", async () => {
        const { stopIsAbout } = await buildPolicy()
        const lead = { key: "lead:lead-1", leadId: "lead-1", conversationId: null }
        const conversation = { key: "conversation:c-1", leadId: null, conversationId: "c-1" }
        expect(stopIsAbout(STOP, lead)).toBe(true)
        expect(stopIsAbout({ leadId: null, conversationId: "c-1" }, conversation)).toBe(true)
        expect(stopIsAbout({ leadId: "lead-2", conversationId: "c-2" }, { ...lead, conversationId: "c-1" })).toBe(false)
        expect(stopIsAbout({ leadId: null, conversationId: null }, { ...lead, conversationId: "c-1" })).toBe(false)
    })

    it("D-P11-4: a stop whose step TOLD a conversation is about it and holds its wakes whatever the workflow; a lead-only wake keeps the workflow rule", async () => {
        const { stopIsAbout, stopHoldsWake } = await buildPolicy()
        const bankFed = { workflowId: "wf-reconcile", leadId: null, conversationId: null, toldConversationIds: ["c-1"] }
        const line = { key: "lead:lead-1|wf:wf-front-desk", leadId: "lead-1", conversationId: "c-1" }
        const timer = { key: "lead:lead-1|wf:wf-care", leadId: "lead-1", conversationId: null }

        expect(stopIsAbout(bankFed, line)).toBe(true)
        expect(stopIsAbout(bankFed, { ...line, conversationId: "c-2" })).toBe(false)
        // The customer's next line goes to the front desk, not to the reconcile that stopped: still held.
        expect(stopHoldsWake(bankFed, "wf-front-desk", line)).toBe(true)
        expect(stopHoldsWake(bankFed, "wf-care", timer)).toBe(false)
        expect(stopHoldsWake({ ...bankFed, toldConversationIds: [] }, "wf-front-desk", line)).toBe(false)
        // The workflow rule stands as before for a stop that told nobody.
        expect(stopHoldsWake(STOP, "wf-front-desk", timer)).toBe(true)
        expect(stopHoldsWake(STOP, "wf-consult", line)).toBe(false)
    })

    it("picks the oldest open stop, ties broken by the run", async () => {
        const { oldestStopOf } = await buildPolicy()
        const later = { ...STOP, runId: "run-9", stoppedAt: "2026-11-10T11:00:00.000Z" }
        const tie = { ...STOP, runId: "run-1" }
        expect(oldestStopOf([later, STOP, tie])?.runId).toBe("run-1")
        expect(oldestStopOf([])).toBeNull()
    })

    it("counts a run that is over, or gone, as one whose stops hold nobody", async () => {
        const { isRunClosed } = await buildPolicy()
        expect(["done", "failed", "cancelled"].map(isRunClosed)).toEqual([true, true, true])
        expect(isRunClosed(null)).toBe(true)
        expect(["running", "waiting"].map(isRunClosed)).toEqual([false, false])
    })
})

describe("lead-freeze-threads.policy: the freeze a stop writes", () => {
    it("keys the hold by the customer's lead, else the conversation, in the stop's workflow", async () => {
        const { stopSubjectOf } = await buildPolicy()
        expect(stopSubjectOf({ key: "lead:lead-1", leadId: "lead-1", conversationId: "c-1" }, STOP)).toEqual({
            key: "lead:lead-1|wf:wf-front-desk",
            leadId: "lead-1",
            conversationId: "c-1",
        })
        expect(stopSubjectOf({ key: "conversation:c-1", leadId: null, conversationId: "c-1" }, STOP)).toEqual({
            key: "conversation:c-1|wf:wf-front-desk",
            leadId: null,
            conversationId: "c-1",
        })
        expect(stopSubjectOf({ key: "lead:lead-1", leadId: "lead-1", conversationId: null }, { workflowId: null }).key).toBe(
            "lead:lead-1",
        )
    })

    it("starts a new episode that points at the run and its step, with no owner item and nothing released", async () => {
        const { threadHoldOf } = await buildPolicy()
        const fresh = releasedFreezeOf({ episode: 2, releaseReason: "skipped", releasedBy: "owner-1", workItemId: "item-9" })
        expect(threadHoldOf(fresh, STOP, "2026-11-10T10:01:00.000Z")).toEqual({
            status: "frozen",
            frozenRunId: "run-7",
            agentId: "chatbot",
            frozenAt: "2026-11-10T10:01:00.000Z",
            frozenReason: THREAD_STOP_REASON,
            stepKey: "consult",
            stepTitle: null,
            episode: 3,
            failures: 1,
            pending: [],
            workItemId: null,
            heldBy: null,
            releasedAt: null,
            releasedBy: null,
            releaseReason: null,
        })
    })
})
