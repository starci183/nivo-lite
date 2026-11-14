import { mock } from "@starci/jest-preset"
import { AgentGraphsError, AgentGraphsErrorCode } from "@modules/domain/agent-graphs/errors/agent-graphs.error"
import type { AgentStepTitlesService, AgentWorkflowsService } from "@modules/domain/agent-graphs"
import type { AgentDirectoryService } from "@modules/domain/agents"
import type { ConnectionsService } from "@modules/domain/connections"
import type { InstallationRecordsService } from "@modules/domain/module-installations"
import type { MemberLookupService } from "@modules/domain/workspace-members"
import { ContactNamesService } from "./contact-names.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = () => {
    const agents = mock<AgentDirectoryService>()
    const installations = mock<InstallationRecordsService>()
    const members = mock<MemberLookupService>()
    const connections = mock<ConnectionsService>()
    const workflows = mock<AgentWorkflowsService>()
    const titles = mock<AgentStepTitlesService>()
    return { agents, installations, members, connections, workflows, titles, service: new ContactNamesService(agents, installations, members, connections, workflows, titles) }
}

describe("ContactNamesService.agentsOf", () => {
    it("names each agent with the installation that runs it, asking once per distinct id and leaving a gone agent out", async () => {
        const { service, agents, installations } = build()
        agents.cardsOf.mockResolvedValue([{ id: "a1", name: "Lan", module: "chatbot" }])
        installations.ofAgent.mockResolvedValue({ id: "inst-1" } as never)

        const named = await service.agentsOf(WS, ["a1", null, "a1", "a-gone"])

        expect(agents.cardsOf).toHaveBeenCalledWith(WS, ["a1", "a-gone"])
        expect(named.get("a1")).toEqual({ agentId: "a1", name: "Lan", moduleKey: "chatbot", installationId: "inst-1" })
        expect(named.has("a-gone")).toBe(false)
    })

    it("keeps an agent that drives no installation, with no installation id", async () => {
        const { service, agents, installations } = build()
        agents.cardsOf.mockResolvedValue([{ id: "a1", name: "Lan", module: "chatbot" }])
        installations.ofAgent.mockResolvedValue(null)

        expect((await service.agentsOf(WS, ["a1"])).get("a1")?.installationId).toBeNull()
    })

    it("asks nothing when there is no id", async () => {
        const { service, agents } = build()

        await expect(service.agentsOf(WS, [null, null])).resolves.toEqual(new Map())
        expect(agents.cardsOf).not.toHaveBeenCalled()
    })
})

describe("ContactNamesService.membersOf", () => {
    it("names the members by their membership id, active or gone, leaving an unknown seat out", async () => {
        const { service, members } = build()
        members.byId.mockImplementation((id) => Promise.resolve(id === "m1" ? { id: "m1", displayName: "Minh" } : null))

        const named = await service.membersOf(["m1", "m1", null, "m-unknown"])

        expect(members.byId).toHaveBeenCalledTimes(2)
        expect([...named]).toEqual([["m1", "Minh"]])
    })
})

describe("ContactNamesService.connectionsOf", () => {
    it("names the connections of the workspace; a site or a removed connection is none", async () => {
        const { service, connections } = build()
        connections.findMany.mockResolvedValue([{ id: "c1", name: "Shop Hoa Zalo", provider: "zalo" } as never])

        const named = await service.connectionsOf(WS, ["c1", "site-1", null])

        expect(connections.findMany).toHaveBeenCalledWith(WS, ["c1", "site-1"])
        expect([...named]).toEqual([["c1", { name: "Shop Hoa Zalo", provider: "zalo" }]])
    })

    it("asks nothing when there is no id", async () => {
        const { service, connections } = build()

        await service.connectionsOf(WS, [null])
        expect(connections.findMany).not.toHaveBeenCalled()
    })
})

describe("ContactNamesService.workflowNamesOf", () => {
    it("reads each workflow's name once in the language asked, and leaves out a workflow that no longer exists", async () => {
        const { service, workflows } = build()
        workflows.detail.mockImplementation((_workspaceId, id) => {
            if (id === "wf-gone") return Promise.reject(new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowNotFound }))
            return Promise.resolve({ workflow: { name: "Bán hàng" } } as never)
        })

        const named = await service.workflowNamesOf(WS, ["wf-1", "wf-1", "wf-gone", null], "vi")

        expect(workflows.detail).toHaveBeenCalledTimes(2)
        expect(workflows.detail).toHaveBeenCalledWith(WS, "wf-1", "vi")
        expect([...named]).toEqual([["wf-1", "Bán hàng"]])
    })

    it("lets a failure that is not a typed refusal through", async () => {
        const { service, workflows } = build()
        workflows.detail.mockRejectedValue(new Error("database down"))

        await expect(service.workflowNamesOf(WS, ["wf-1"], "en")).rejects.toThrow("database down")
    })
})

describe("ContactNamesService.stepTitleOf", () => {
    it("answers the title its installed node declares in the language asked", () => {
        const { service, titles } = build()
        titles.titleOf.mockReturnValue({ vi: "Tư vấn khách", en: "Advise the customer" })

        expect(service.stepTitleOf("chatbot.answer", "vi")).toBe("Tư vấn khách")
        expect(service.stepTitleOf("chatbot.answer", "en")).toBe("Advise the customer")
    })

    it("answers null, never the key, for a step no installed node declares and for an entry that names no step", () => {
        const { service, titles } = build()
        titles.titleOf.mockReturnValue(null)

        expect(service.stepTitleOf("removed.plugin.step", "vi")).toBeNull()
        expect(service.stepTitleOf(null, "vi")).toBeNull()
    })
})
