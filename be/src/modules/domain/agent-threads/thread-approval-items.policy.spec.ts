import type { RunStop } from "./stops/run-stop.contracts"
import { openApprovalItemOf } from "./thread-approval-items.policy"

const stopOf = (over: Partial<RunStop>): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "send-qr",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: "lead-1",
    conversationId: "conv-1",
    kind: "approval",
    state: "open",
    reason: "The AI needs your approval",
    question: null,
    detail: { suggestions: [], facts: [{ name: "tool", value: "nivo.tool.payment.transfer.create" }, { name: "workItemId", value: "item-1" }] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T09:00:00.000Z",
    resolvedAt: null,
    ...over,
})

describe("openApprovalItemOf (the run page's approve and refuse on a thread run)", () => {
    it("names the owner item of the run's open approval stop: the named step's, else the newest", () => {
        const older = stopOf({})
        const newer = stopOf({
            stepKey: "notify",
            stoppedAt: "2026-11-10T09:30:00.000Z",
            detail: { suggestions: [], facts: [{ name: "workItemId", value: "item-2" }] },
        })

        expect(openApprovalItemOf([older, newer], "send-qr")).toEqual({ stepKey: "send-qr", workItemId: "item-1" })
        expect(openApprovalItemOf([older, newer], null)).toEqual({ stepKey: "notify", workItemId: "item-2" })
    })

    it("names nothing for a run with no open approval: a resolved one, a report stop, another step, or a stop naming no item", () => {
        const resolved = stopOf({ state: "resolved" })
        const report = stopOf({ stepKey: "match", kind: "ai_report" })
        const bare = stopOf({ stepKey: "bare", detail: { suggestions: [], facts: [] } })

        expect(openApprovalItemOf([resolved, report], null)).toBeNull()
        expect(openApprovalItemOf([resolved, report], "match")).toBeNull()
        expect(openApprovalItemOf([bare], "bare")).toBeNull()
        expect(openApprovalItemOf([], null)).toBeNull()
    })
})
