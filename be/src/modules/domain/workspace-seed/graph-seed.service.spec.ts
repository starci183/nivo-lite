import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { NodeInstall } from "@nivo-lite/agent-sdk/node"
import { AgentGraphFlowService } from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { GraphSeedService } from "./graph-seed.service"
import { SEED_AGENTS, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { SeedAgentRecords } from "./workspace-seed.port"

const NODES: NodeInstall = { nodes: [], effects: [], tools: [], dataKinds: [] }
const SPEC = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}
const TEXT = `${JSON.stringify({ documents: [{ path: "data/graphs/sales.json", document: SPEC }] })}\n`
const MODULE = {
    key: "sales",
    name: { vi: "Bán hàng", en: "Sales" },
    defaultOperatingMode: "assist",
    agent: {
        label: { vi: "Agent Bán hàng", en: "Sales agent" },
        handle: "sales",
        role: { vi: "Chốt đơn", en: "Closes orders" },
        instructions: { vi: "Trả lời khách", en: "Answer customers" },
    },
} as unknown as ModuleDefinition
const record = (over: Partial<InstallationRecord> = {}): InstallationRecord =>
    ({ id: "inst-1", workspaceId: "ws-1", moduleKey: "sales", agentId: "agent-1", ...over }) as InstallationRecord

interface Scenario {
    readonly workspaces?: ReadonlyArray<{ id: string; name: string }>
    readonly held?: ReadonlyArray<InstallationRecord | null>
    readonly inserted?: string | null
    readonly nodes?: NodeInstall | undefined
}

const build = async (scenario: Scenario = {}) => {
    const workspaces = mock<WorkspacesService>()
    workspaces.list.mockResolvedValue(scenario.workspaces ?? [{ id: "ws-1", name: "NIVO" }])
    const modules = mock<ModulesService>()
    modules.find.mockResolvedValue(MODULE)
    const installations = mock<InstallationRecordsService>()
    const held = [...(scenario.held ?? [record()])]
    installations.firstOfModule.mockImplementation(() => Promise.resolve(held.shift() ?? null))
    installations.insert.mockResolvedValue(scenario.inserted === undefined ? "inst-1" : scenario.inserted)
    const agents = mock<SeedAgentRecords>()
    agents.ensureByHandle.mockResolvedValue("agent-1")
    const flows = mock<AgentGraphFlowService>()
    flows.publish.mockResolvedValue("created")
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphSeedService,
            {
                provide: WORKSPACE_SEED_OPTIONS,
                useValue: { print, ...("nodes" in scenario ? { nodes: scenario.nodes } : { nodes: NODES }) },
            },
            { provide: SEED_AGENTS, useValue: agents },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: ModulesService, useValue: modules },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphFlowService, useValue: flows },
        ],
    }).compile()
    return { service: moduleRef.get(GraphSeedService), agents, installations, flows, print }
}

const failure = (code: WorkspaceSeedErrorCode) => new WorkspaceSeedError({ code })

describe("GraphSeedService > run", () => {
    it("publishes the flow to the agent of the module installed in the named workspace, and prints no value", async () => {
        const { service, agents, installations, flows, print } = await build()

        await service.run(TEXT, "NIVO")

        expect(flows.publish).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            installationId: "inst-1",
            flow: SPEC,
            installed: expect.objectContaining({ nodes: expect.any(Map) }),
        })
        expect(agents.ensureByHandle).not.toHaveBeenCalled()
        expect(installations.insert).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([["sales agent agent-1 graph created"]])
    })

    it("installs the module first when the workspace has none: its agent under the handle of the module, then the installation", async () => {
        const { service, agents, installations, flows } = await build({ held: [null, record()] })

        await service.run(TEXT, "NIVO")

        expect(agents.ensureByHandle).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            module: "sales",
            name: "Agent Bán hàng",
            handle: "sales",
            role: "Chốt đơn",
            instructions: "Trả lời khách",
        })
        expect(installations.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            moduleKey: "sales",
            name: "Bán hàng",
            agentId: "agent-1",
            operatingMode: "assist",
        })
        expect(flows.publish).toHaveBeenCalledWith(expect.objectContaining({ agentId: "agent-1", installationId: "inst-1" }))
    })

    it("reads back the installation another run made when its own insert lost the race", async () => {
        const { service, flows } = await build({ held: [null, record({ id: "inst-9" })], inserted: null })

        await service.run(TEXT, "NIVO")

        expect(flows.publish).toHaveBeenCalledWith(expect.objectContaining({ installationId: "inst-9" }))
    })

    it.each([
        ["an installation that cannot be read back after its insert", { held: [null, null] }],
        ["an installation without an agent", { held: [record({ agentId: null })] }],
    ])("refuses %s", async (_name, scenario) => {
        const { service, flows } = await build(scenario)

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.RowMissing))

        expect(flows.publish).not.toHaveBeenCalled()
    })

    it("refuses a workspace that does not exist and one whose name is ambiguous, before anything is installed", async () => {
        const none = await build({ workspaces: [] })
        const twice = await build({
            workspaces: [
                { id: "ws-1", name: "NIVO" },
                { id: "ws-2", name: "NIVO" },
            ],
        })

        await expect(none.service.run(TEXT, "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.RowMissing))
        await expect(twice.service.run(TEXT, "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.InputInvalid))
        expect(none.installations.firstOfModule).not.toHaveBeenCalled()
        expect(twice.installations.firstOfModule).not.toHaveBeenCalled()
    })

    it("refuses to run when the app installs no nodes to judge the graphs against", async () => {
        const { service, flows } = await build({ nodes: undefined })

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.InputRequired))

        expect(flows.publish).not.toHaveBeenCalled()
    })

    it("refuses a document that is not a graph spec", async () => {
        const { service } = await build()

        await expect(service.run("{}", "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.InputInvalid))
    })
})
