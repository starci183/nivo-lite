import { mock } from "@starci/jest-preset"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { ContactWorkService, type ContactWorkStep } from "@modules/domain/contacts"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ContactNamesService } from "./contact-names.service"
import { ReadContactWorkQuery } from "./contacts.queries"
import { ReadContactWorkHandler } from "./read-contact-work.handler"

const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }
const REQUEST = { workspaceId: "ws-1", contactId: "contact-1", locale: "vi" as const, limit: 20 }

const stepOf = (id: string, over: Partial<ContactWorkStep> = {}): ContactWorkStep => ({
    id,
    namespace: "sales.consult",
    nodeKey: "talk[r2].opening",
    node: "opening",
    round: 2,
    step: "chatbot.answer",
    status: "done",
    at: "2026-11-14T10:00:00.000Z",
    agentId: "agent-1",
    workflowId: "wf-1",
    runId: "run-1",
    ...over,
})

const build = () => {
    const access = mock<AgentWorkAccessService>()
    const work = mock<ContactWorkService>()
    const names = mock<ContactNamesService>()
    access.manager.mockResolvedValue("member-1")
    work.recent.mockResolvedValue([])
    names.workflowNamesOf.mockResolvedValue(new Map())
    names.agentsOf.mockResolvedValue(new Map())
    names.stepTitleOf.mockReturnValue(null)
    return { access, work, names, handler: new ReadContactWorkHandler(mock<Logger>(), access, work, names) }
}

const run = (handler: ReadContactWorkHandler) => handler.execute(new ReadContactWorkQuery({ request: REQUEST, principal: PRINCIPAL }))

describe("ReadContactWorkHandler (contactWork)", () => {
    it("puts the workflow title, the step title and the agent name on each row, and the round as data only", async () => {
        const { handler, work, names, access } = build()
        work.recent.mockResolvedValue([stepOf("e1")])
        names.workflowNamesOf.mockResolvedValue(new Map([["wf-1", "Bán hàng"]]))
        names.agentsOf.mockResolvedValue(new Map([["agent-1", { agentId: "agent-1", name: "Lan", moduleKey: "chatbot", installationId: "inst-1" }]]))
        names.stepTitleOf.mockReturnValue("Tư vấn khách")

        await expect(run(handler)).resolves.toEqual([
            {
                id: "e1",
                workflowLabel: "Bán hàng",
                stepLabel: "Tư vấn khách",
                status: "done",
                round: 2,
                at: "2026-11-14T10:00:00.000Z",
                agentId: "agent-1",
                agentName: "Lan",
                runId: "run-1",
            },
        ])
        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(work.recent).toHaveBeenCalledWith("ws-1", "contact-1", 20)
        expect(names.stepTitleOf).toHaveBeenCalledWith("chatbot.answer", "vi")
        expect(names.workflowNamesOf).toHaveBeenCalledWith("ws-1", ["wf-1"], "vi")
    })

    it("leaves a label null, never a raw key, when nothing declares it: a workflow that is gone, a step no installed node declares, an agent that is gone", async () => {
        const { handler, work } = build()
        work.recent.mockResolvedValue([
            stepOf("e1", { workflowId: "wf-gone", step: "removed.plugin.step", agentId: "agent-gone", status: "failed", round: null }),
            stepOf("e2", { workflowId: null, step: null, agentId: null, status: "passed_over", round: null }),
        ])

        const rows = await run(handler)

        expect(rows.map((row) => [row.workflowLabel, row.stepLabel, row.agentName, row.status, row.round])).toEqual([
            [null, null, null, "failed", null],
            [null, null, null, "passed_over", null],
        ])
    })

    it("answers none, and names nothing, for a deleted contact (R31) or one the agents did nothing for", async () => {
        const { handler, names } = build()

        await expect(run(handler)).resolves.toEqual([])
        expect(names.workflowNamesOf).not.toHaveBeenCalled()
        expect(names.agentsOf).not.toHaveBeenCalled()
    })

    it("refuses a person without the owner or manager seat before reading anything", async () => {
        const { handler, access, work } = build()
        access.manager.mockRejectedValue(new Error("not a manager"))

        await expect(run(handler)).rejects.toThrow("not a manager")
        expect(work.recent).not.toHaveBeenCalled()
    })
})
