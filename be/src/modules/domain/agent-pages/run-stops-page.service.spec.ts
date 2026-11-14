import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { RunStopRecordsService, type RunStop } from "@modules/domain/agent-threads"
import { AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ContactsService, type ContactWithIdentities } from "@modules/domain/contacts"
import { RunStopsPageService } from "./run-stops-page.service"

const stopOf = builder<RunStop>({
    id: "stop-1",
    version: "v1",
    runId: "run-1",
    stepKey: "ask",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: "contact-1",
    conversationId: "conv-1",
    kind: "ai_report",
    state: "open",
    reason: "Kh\u00e1ch h\u1ecfi gi\u00e1 s\u1ec9, t\u00e0i li\u1ec7u kh\u00f4ng c\u00f3",
    question: "Gi\u00e1 s\u1ec9 l\u00e0 bao nhi\u00eau?",
    detail: { suggestions: [{ text: "B\u00e1o gi\u00e1 10%", handledBy: "person" }], facts: [] },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-13T07:00:00.000Z",
    resolvedAt: null,
})

const APPROVAL = stopOf({
    id: "stop-2",
    runId: "run-2",
    stepKey: "refund",
    kind: "approval",
    reason: "Ho\u00e0n ti\u1ec1n \u0111\u01a1n A12",
    question: null,
    contactId: null,
    conversationId: null,
    detail: {
        suggestions: [],
        facts: [
            { name: "workItemId", value: "wi-7" },
            { name: "tool", value: "nivo.tool.payment.refund.create" },
            { name: "account", value: "SePay ACB" },
            { name: "ability", value: "refund.create" },
            { name: "amount", value: "250000" },
        ],
    },
})

const contactOf = (displayName: string): ContactWithIdentities => mock<ContactWithIdentities>({ id: "contact-1", displayName })

const build = async (stops: ReadonlyArray<RunStop>, open = stops.length) => {
    const access = mock<AgentWorkAccessService>()
    const records = mock<RunStopRecordsService>()
    const agents = mock<AgentDirectoryService>()
    const runs = mock<AgentWorkflowRunsService>()
    const contacts = mock<ContactsService>()
    access.manager.mockResolvedValue("member-1")
    records.newest.mockResolvedValue([...stops])
    records.openCount.mockResolvedValue(open)
    agents.cardsOf.mockResolvedValue([{ id: "agent-1", name: "Mai", module: "sales" }])
    runs.pinsOf.mockResolvedValue([{ runId: "run-1", workflowId: "wf-1", workflowName: "T\u01b0 v\u1ea5n", version: 2 }])
    contacts.get.mockResolvedValue(contactOf("Ch\u1ecb Lan"))
    const container = await Test.createTestingModule({
        providers: [
            RunStopsPageService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: RunStopRecordsService, useValue: records },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: AgentWorkflowRunsService, useValue: runs },
            { provide: ContactsService, useValue: contacts },
        ],
    }).compile()
    return { service: container.get(RunStopsPageService), access, records, contacts }
}

describe("RunStopsPageService.open: the open stops of the workspace, as a person who may decide them reads them", () => {
    it("checks the owner / manager seat (the deciding door's guard) before reading any stop", async () => {
        const { service, access, records } = await build([])
        access.manager.mockRejectedValue(new Error("forbidden"))

        await expect(service.open("user-1", "ws-1", undefined, undefined)).rejects.toThrow("forbidden")
        expect(records.newest).not.toHaveBeenCalled()
    })

    it("answers each open stop with what answering it needs: kind, the choices, the run, workflow, agent and contact names", async () => {
        const { service, records } = await build([stopOf()])

        await expect(service.open("user-1", "ws-1", undefined, undefined)).resolves.toEqual({
            stops: [
                {
                    stopId: "stop-1",
                    runId: "run-1",
                    stepKey: "ask",
                    kind: "ai_report",
                    reason: "Kh\u00e1ch h\u1ecfi gi\u00e1 s\u1ec9, t\u00e0i li\u1ec7u kh\u00f4ng c\u00f3",
                    question: "Gi\u00e1 s\u1ec9 l\u00e0 bao nhi\u00eau?",
                    suggestions: ["B\u00e1o gi\u00e1 10%"],
                    needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
                    approval: null,
                    agentId: "agent-1",
                    agentName: "Mai",
                    workflowId: "wf-1",
                    workflowName: "T\u01b0 v\u1ea5n",
                    contactId: "contact-1",
                    contactName: "Ch\u1ecb Lan",
                    conversationId: "conv-1",
                    repeats: 1,
                    stoppedAt: "2026-11-13T07:00:00.000Z",
                },
            ],
            total: 1,
            next: null,
        })
        expect(records.newest).toHaveBeenCalledWith("ws-1", "open", 20)
    })

    it("names an approval's tool, account, ability and arguments, and asks a verdict (approve / refuse), never words", async () => {
        const { service } = await build([APPROVAL])

        const page = await service.open("user-1", "ws-1", undefined, undefined)

        expect(page.stops[0]).toMatchObject({
            kind: "approval",
            needs: { answer: false, decisions: [], verdicts: ["approve", "refuse"] },
            approval: {
                workItemId: "wi-7",
                tool: "nivo.tool.payment.refund.create",
                account: "SePay ACB",
                ability: "refund.create",
                args: [{ name: "amount", value: "250000" }],
            },
            contactName: null,
            workflowName: null,
        })
    })

    it("pages by position: the next page starts where the first ended, and the last page names no next", async () => {
        const stops = [stopOf({ id: "a" }), stopOf({ id: "b" }), stopOf({ id: "c" })]
        const { service, records } = await build(stops, 3)

        const first = await service.open("user-1", "ws-1", 2, undefined)
        expect(first.stops.map((stop) => stop.stopId)).toEqual(["a", "b"])
        expect(first.next).toBe("2")
        expect(records.newest).toHaveBeenLastCalledWith("ws-1", "open", 2)

        const second = await service.open("user-1", "ws-1", 2, "2")
        expect(second.stops.map((stop) => stop.stopId)).toEqual(["c"])
        expect(second.next).toBeNull()
        expect(records.newest).toHaveBeenLastCalledWith("ws-1", "open", 4)
    })
})
