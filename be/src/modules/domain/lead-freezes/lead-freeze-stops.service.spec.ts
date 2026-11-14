import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RunStopRecordsService, type RunStop } from "@modules/domain/agent-threads"
import { LeadFreezeStopsService } from "./lead-freeze-stops.service"

const stopOf = (id: string, values: Partial<RunStop> = {}): RunStop => ({
    id,
    version: "2",
    runId: "run-7",
    stepKey: "consult",
    agentId: "chatbot",
    workflowId: "wf-front-desk",
    contactId: "lead-1",
    conversationId: "c-1",
    kind: "ai_report",
    state: "open",
    reason: "why",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T10:00:00.000Z",
    resolvedAt: null,
    ...values,
})

const OPEN = stopOf("stop-1")

const build = async () => {
    const stops = mock<RunStopRecordsService>()
    stops.ofContacts.mockResolvedValue([])
    stops.newest.mockResolvedValue([])
    stops.ofRun.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [LeadFreezeStopsService, { provide: RunStopRecordsService, useValue: stops }],
    }).compile()
    return { service: moduleRef.get(LeadFreezeStopsService), stops }
}

describe("LeadFreezeStopsService: the open stops a freeze reads: a customer or a run", () => {
    it("reads the open stops of a customer by the lead and by the open stops, merged once each", async () => {
        const { service, stops } = await build()
        stops.ofContacts.mockResolvedValueOnce([OPEN])
        stops.newest.mockResolvedValueOnce([
            OPEN,
            stopOf("stop-2", { runId: "run-8", contactId: null }),
            stopOf("stop-3", { runId: "run-9", contactId: null, conversationId: "c-2" }),
        ])

        const open = await service.openOfCustomer("ws-1", { contactId: "lead-1", conversationId: "c-1" })

        expect(open.map((stop) => stop.runId)).toEqual(["run-7", "run-8"])
        expect(open[0]).toEqual({
            runId: "run-7",
            stepKey: "consult",
            agentId: "chatbot",
            workflowId: "wf-front-desk",
            contactId: "lead-1",
            conversationId: "c-1",
            toldConversationIds: [],
            stoppedAt: "2026-11-10T10:00:00.000Z",
        })
        expect(stops.ofContacts.mock.calls).toEqual([["ws-1", ["lead-1"], "open", 50]])
        expect(stops.newest.mock.calls).toEqual([["ws-1", "open", 100]])
    })

    it("reads the open stops of a run, the state matched in code", async () => {
        const { service, stops } = await build()
        stops.ofRun.mockResolvedValue([
            OPEN,
            stopOf("stop-2", { stepKey: "match", state: "resolved" }),
            stopOf("stop-4", { stepKey: "close", stoppedAt: "2026-11-10T09:59:00.000Z" }),
        ])

        const open = await service.openOfRun("ws-1", "run-7")

        expect(open.map((stop) => stop.stepKey)).toEqual(["consult", "close"])
        expect(open[1]?.stoppedAt).toBe("2026-11-10T09:59:00.000Z")
        expect(stops.ofRun).toHaveBeenCalledWith("ws-1", "run-7")
    })

    it("reads only by the lead, or only by the open stops, for a customer who names only one, and nothing for neither", async () => {
        const { service, stops } = await build()

        await service.openOfCustomer("ws-1", { contactId: "lead-1", conversationId: null })
        await service.openOfCustomer("ws-1", { contactId: null, conversationId: "c-1" })
        await expect(service.openOfCustomer("ws-1", { contactId: null, conversationId: null })).resolves.toEqual([])

        expect(stops.ofContacts).toHaveBeenCalledTimes(1)
        expect(stops.newest).toHaveBeenCalledTimes(1)
    })
})

describe("LeadFreezeStopsService: the open stops a freeze reads: a told conversation", () => {
    it("D-P11-4: a stop of a run about no customer is found by the conversation its step TOLD (customer lines)", async () => {
        const { service, stops } = await build()
        const told = stopOf("stop-5", {
            runId: "run-bank",
            stepKey: "match",
            workflowId: "wf-reconcile",
            contactId: null,
            conversationId: null,
            customerLines: [{ conversationId: "c-1", text: "Shop da nhan, dang kiem tra", at: "2026-11-10T10:00:00.000Z" }],
        })
        stops.newest.mockResolvedValue([told, stopOf("stop-6", { ...told, id: "stop-6", runId: "run-other", customerLines: [] })])

        const open = await service.openOfCustomer("ws-1", { contactId: null, conversationId: "c-1" })

        expect(
            open.map((stop) => [stop.runId, stop.contactId, stop.conversationId, stop.toldConversationIds]),
        ).toEqual([["run-bank", null, null, ["c-1"]]])
    })
})
