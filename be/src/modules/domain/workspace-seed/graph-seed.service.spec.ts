import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { NodeInstall } from "@nivo-lite/agent-sdk/node"
import {
    AgentBindingsService,
    AgentConnectionsError,
    AgentConnectionsErrorCode,
} from "@modules/domain/agent-connections"
import { AgentGraphFlowService } from "@modules/domain/agent-graphs"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord, InstallationStatus } from "@modules/domain/module-installations"
import { ModuleTagGrantsService, ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { GraphSeedService } from "./graph-seed.service"
import { ProfileActivationService } from "./profile-activation.service"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import { SEED_AGENTS, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { ProfileStatuses } from "./workspace-profile.contracts"
import type { SeedAgentRecords } from "./workspace-seed.port"
import { installationRecordOf } from "@tests/fixtures/builders/module-install.builder"

const NODES: NodeInstall = { nodes: [], effects: [], tools: [], dataKinds: [] }
const SPEC = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}
const TEXT = `${JSON.stringify({ documents: [{ path: "data/graphs/sales.json", document: SPEC }] })}\n`
/** A gate whose hint is the evidence the seed answers it with. */
const gateOf = (key: string, hint: string): ModuleDefinition["gates"][number] => ({
    key,
    label_vi: key,
    label_en: key,
    hint_vi: hint,
    hint_en: hint,
})

/** The test module under `key`: two gates, one governed action and its agent under the same handle. */
const moduleOf = (key: string): ModuleDefinition =>
    Object.assign(mock<ModuleDefinition>(), {
        key,
        name: { vi: "Ban hang", en: "Sales" },
        defaultOperatingMode: "assist",
        gates: [gateOf("identity", "Shop name and trade"), gateOf("products", "Products sold")],
        authorityActions: [
            {
                action: "create_order",
                label: { vi: "Create order", en: "Create order" },
                mode: "ask",
                limitVnd: 5_000_000,
                requiredFields: ["total"],
                amountLimit: true,
            },
        ],
        agent: {
            label: { vi: "Agent Ban hang", en: "Sales agent" },
            handle: key,
            role: { vi: "Chot don", en: "Closes orders" },
            instructions: { vi: "Tra loi khach", en: "Answer customers" },
        },
    })
const MODULE = moduleOf("sales")
const record = (over: Partial<InstallationRecord> = {}): InstallationRecord =>
    installationRecordOf({ moduleKey: "sales", status: "ready", ...over })

interface Scenario {
    readonly workspaces?: ReadonlyArray<{ id: string; name: string }>
    readonly held?: ReadonlyArray<InstallationRecord | null>
    readonly inserted?: string | null
    readonly nodes?: NodeInstall | undefined
    readonly owner?: string | null
    readonly holds?: boolean
    readonly status?: InstallationStatus
}

const build = async (scenario: Scenario = {}) => {
    const workspaces = mock<WorkspacesService>()
    workspaces.list.mockResolvedValue(scenario.workspaces ?? [{ id: "ws-1", name: "NIVO" }])
    workspaces.ownerIdOf.mockResolvedValue(scenario.owner === undefined ? "owner-1" : scenario.owner)
    const modules = mock<ModulesService>()
    modules.find.mockResolvedValue(MODULE)
    modules.sync.mockResolvedValue({ modules: 1, actions: 1, staleModules: [], staleActions: [] })
    const installations = mock<InstallationRecordsService>()
    const held = [...(scenario.held ?? [record()])]
    installations.firstOfModule.mockImplementation(() => Promise.resolve(held.shift() ?? null))
    installations.insert.mockResolvedValue(scenario.inserted === undefined ? "inst-1" : scenario.inserted)
    const agents = mock<SeedAgentRecords>()
    agents.ensureByHandle.mockResolvedValue("agent-1")
    const rules = mock<AuthorityRulesService>()
    const activation = mock<ProfileActivationService>()
    const statuses: ProfileStatuses = { sales: scenario.status ?? "live" }
    activation.activate.mockResolvedValue(statuses)
    const flows = mock<AgentGraphFlowService>()
    flows.publish.mockResolvedValue("created")
    const bindings = mock<AgentBindingsService>()
    const tagGrants = mock<ModuleTagGrantsService>()
    tagGrants.grantFor.mockResolvedValue(undefined)
    flows.holds.mockResolvedValue(scenario.holds ?? false)
    const abilities = mock<ProviderAbilitiesService>()
    abilities.attachDefaults.mockResolvedValue({ ok: true, attached: [] })
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
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ProfileActivationService, useValue: activation },
            { provide: AgentGraphFlowService, useValue: flows },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ModuleTagGrantsService, useValue: tagGrants },
            { provide: ProviderAbilitiesService, useValue: abilities },
        ],
    }).compile()
    return {
        service: moduleRef.get(GraphSeedService),
        agents,
        installations,
        rules,
        activation,
        flows,
        print,
        bindings,
        modules,
        tagGrants,
        abilities,
    }
}

const failure = (code: WorkspaceSeedErrorCode) => new WorkspaceSeedError({ code })

const LEDGER_SPEC = {
    ...SPEC,
    moduleKey: "accounting",
    grant: {
        rights: [],
        tools: ["nivo.ledger.entry.append", "nivo.ledger.entry.void", "nivo.ledger.status.get", "nivo.chat.send"],
        effects: [],
    },
}
const LEDGER_TEXT = `${JSON.stringify({ documents: [{ path: "data/graphs/accounting.json", document: LEDGER_SPEC }] })}\n`

describe("GraphSeedService > default provider rights", () => {
    it("attaches the agent to the connected providers its module names, by the module's defaults and only where it holds none", async () => {
        const { service, abilities, print } = await build()
        abilities.attachDefaults.mockResolvedValue({
            ok: true,
            attached: [{ connectionId: "conn-google", provider: "google", abilities: { "ledger.write": "auto" } }],
        })

        await service.run(LEDGER_TEXT, "NIVO")

        expect(abilities.attachDefaults).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1", moduleKey: expect.any(String) },
            null,
            null,
        )
        expect(print).toHaveBeenCalledWith(expect.stringContaining("attached to google"))
    })

    it("does it on a rerun too, when the module is live and already runs the flow", async () => {
        const { service, abilities, activation } = await build({ held: [record({ status: "live" })], holds: true })

        await service.run(LEDGER_TEXT, "NIVO")

        expect(activation.activate).not.toHaveBeenCalled()
        expect(abilities.attachDefaults).toHaveBeenCalledTimes(1)
    })
})

describe("GraphSeedService > tag rights", () => {
    it("grants the tag rights of the module to the agent it seats, as the install door does", async () => {
        const { service, tagGrants } = await build()

        await service.run(TEXT, "NIVO")

        expect(tagGrants.grantFor).toHaveBeenCalledWith("ws-1", "sales", "agent-1")
    })

    it("grants them on a rerun too, when the module is live and already runs the flow", async () => {
        const { service, tagGrants, activation } = await build({ held: [record({ status: "live" })], holds: true })

        await service.run(TEXT, "NIVO")

        expect(activation.activate).not.toHaveBeenCalled()
        expect(tagGrants.grantFor).toHaveBeenCalledWith("ws-1", "sales", "agent-1")
    })

    it("grants them to an agent it had to install, once the agent has its seat", async () => {
        const { service, tagGrants, installations } = await build({ held: [null, record()] })

        await service.run(TEXT, "NIVO")

        expect(installations.insert).toHaveBeenCalledTimes(1)
        expect(tagGrants.grantFor).toHaveBeenCalledWith("ws-1", "sales", "agent-1")
    })
})

describe("GraphSeedService > run", () => {
    it("mirrors the module catalogue before it seeds a rule, so an empty database has the authority actions the rules name", async () => {
        const { service, modules, rules } = await build()

        await service.run(TEXT, "NIVO")

        expect(modules.sync).toHaveBeenCalledTimes(1)
        expect(modules.sync.mock.invocationCallOrder[0]).toBeLessThan(
            rules.seedDefaults.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it("publishes the flow to the agent of the module installed in the named workspace, and prints no value", async () => {
        const { service, agents, installations, rules, activation, flows, print } = await build()

        await service.run(TEXT, "NIVO")

        expect(rules.seedDefaults).toHaveBeenCalledWith("ws-1", "sales", [
            { action: "create_order", mode: "ask", limit_vnd: 5_000_000, required_fields: ["total"] },
        ])
        expect(activation.activate).toHaveBeenCalledWith({ workspaceId: "ws-1", ownerId: "owner-1" }, [
            {
                handle: "sales",
                installation: record(),
                answers: [
                    { gate: "identity", evidence: "Shop name and trade" },
                    { gate: "products", evidence: "Products sold" },
                ],
            },
        ])

        expect(flows.publish).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", agentId: "agent-1", installationId: "inst-1", flow: SPEC }),
        )
        expect(flows.publish.mock.calls[0]?.[0].installed.nodes).toBeInstanceOf(Map)
        expect(agents.ensureByHandle).not.toHaveBeenCalled()
        expect(installations.insert).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([["sales agent agent-1 live, graph created, 1 connections assigned"]])
    })

    it("costs reads only when the module is live and already runs the flow: no rule, activation or publish", async () => {
        const { service, agents, installations, rules, activation, flows, print } = await build({
            held: [record({ status: "live" })],
            holds: true,
        })

        await service.run(TEXT, "NIVO")

        expect(flows.holds).toHaveBeenCalledWith("ws-1", "agent-1", SPEC)
        expect(rules.seedDefaults).not.toHaveBeenCalled()
        expect(activation.activate).not.toHaveBeenCalled()
        expect(flows.publish).not.toHaveBeenCalled()
        expect(agents.ensureByHandle).not.toHaveBeenCalled()
        expect(installations.insert).not.toHaveBeenCalled()
        expect(print.mock.calls).toEqual([["sales agent agent-1 live, graph unchanged"]])
    })

    it("goes the whole way when the module is live but runs another flow, or runs the flow but is not live", async () => {
        const newer = await build({ held: [record({ status: "live" })], holds: false })
        const waiting = await build({ held: [record({ status: "needs_connection" })], holds: true })

        await newer.service.run(TEXT, "NIVO")
        await waiting.service.run(TEXT, "NIVO")

        expect(newer.flows.publish).toHaveBeenCalledTimes(1)
        expect(waiting.flows.publish).toHaveBeenCalledTimes(1)
        expect(waiting.flows.holds).not.toHaveBeenCalled()
    })
})

describe("GraphSeedService > run on a workspace without the module", () => {
    it("installs the module first when the workspace has none: its agent under the handle of the module, then the installation", async () => {
        const { service, agents, installations, flows } = await build({ held: [null, record()] })

        await service.run(TEXT, "NIVO")

        expect(agents.ensureByHandle).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            module: "sales",
            name: "Agent Ban hang",
            handle: "sales",
            role: "Chot don",
            instructions: "Tra loi khach",
        })
        expect(installations.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            moduleKey: "sales",
            name: "Ban hang",
            agentId: "agent-1",
            operatingMode: "assist",
        })
        expect(flows.publish).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-1", installationId: "inst-1" }),
        )
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

    it("reports the status the activation settled in, and one it does not report as unknown", async () => {
        const waiting = await build({ status: "needs_connection" })
        const silent = await build()
        silent.activation.activate.mockResolvedValue({})

        await waiting.service.run(TEXT, "NIVO")
        await silent.service.run(TEXT, "NIVO")

        expect(waiting.print).toHaveBeenCalledWith(
            "sales agent agent-1 needs_connection, graph created, 1 connections assigned",
        )
        expect(silent.print).toHaveBeenCalledWith("sales agent agent-1 unknown, graph created, 1 connections assigned")
    })
})

describe("GraphSeedService > run refusals", () => {
    it("refuses a workspace that has no owner, before anything is installed", async () => {
        const { service, installations } = await build({ owner: null })

        await expect(service.run(TEXT, "NIVO")).rejects.toThrow(failure(WorkspaceSeedErrorCode.RowMissing))

        expect(installations.firstOfModule).not.toHaveBeenCalled()
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

describe("GraphSeedService > connection assignment", () => {
    const SEPAY = "44c471c0-1a75-42e2-ac4b-09dded78c263"
    const ZALO_OA = "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f"
    const TELEGRAM = "72f2699d-7f93-45e1-964a-8a2228137985"

    const asModule = async (key: string, scenario: Scenario = {}) => {
        const built = await build({ held: [record({ moduleKey: key })], ...scenario })
        built.modules.find.mockResolvedValue(moduleOf(key))
        const statuses: ProfileStatuses = { [key]: "live" }
        built.activation.activate.mockResolvedValue(statuses)
        const text = `${JSON.stringify({ documents: [{ path: `data/graphs/${key}.json`, document: { ...SPEC, moduleKey: key } }] })}
`
        return { ...built, text }
    }

    it("assigns the accounting agent to the SePay feed for its bank feed", async () => {
        const { service, bindings, print, text } = await asModule("accounting")

        await service.run(text, "NIVO")

        expect(bindings.grant).toHaveBeenCalledTimes(1)
        expect(bindings.grant).toHaveBeenCalledWith("owner-1", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            connectionId: SEPAY,
            purpose: "bank_feed",
        })
        expect(print).toHaveBeenCalledWith("accounting agent agent-1 live, graph created, 1 connections assigned")
    })

    it("assigns the chatbot to the Zalo OA and to Telegram for inbound chat", async () => {
        const { service, bindings, text } = await asModule("chatbot")

        await service.run(text, "NIVO")

        expect(bindings.grant.mock.calls.map(([, grant]) => [grant.connectionId, grant.purpose])).toEqual([
            [ZALO_OA, "inbound_chat"],
            [TELEGRAM, "inbound_chat"],
        ])
    })

    it("assigns the sales agent to the SePay account as a data source", async () => {
        const { service, bindings, print, text } = await asModule("sales")

        await service.run(text, "NIVO")

        expect(bindings.grant).toHaveBeenCalledTimes(1)
        expect(bindings.grant).toHaveBeenCalledWith("owner-1", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            connectionId: SEPAY,
            purpose: "data_source",
        })
        expect(print).toHaveBeenCalledWith("sales agent agent-1 live, graph created, 1 connections assigned")
    })

    it("assigns again on a rerun without error, and assigns nothing for a module with no connection", async () => {
        const rerun = await asModule("accounting")
        const other = await asModule("care")

        await rerun.service.run(rerun.text, "NIVO")
        await other.service.run(other.text, "NIVO")

        expect(rerun.bindings.grant).toHaveBeenCalledTimes(1)
        expect(other.bindings.grant).not.toHaveBeenCalled()
    })

    it("skips a connection the workspace does not hold and still assigns the others, but stops on any other refusal", async () => {
        const skipping = await asModule("chatbot")
        skipping.bindings.grant
            .mockRejectedValueOnce(new AgentConnectionsError({ code: AgentConnectionsErrorCode.TargetNotFound }))
            .mockResolvedValueOnce(undefined)
        const failing = await asModule("chatbot")
        failing.bindings.grant.mockRejectedValue(new Error("db down"))

        await skipping.service.run(skipping.text, "NIVO")
        await expect(failing.service.run(failing.text, "NIVO")).rejects.toThrow("db down")

        expect(skipping.bindings.grant).toHaveBeenCalledTimes(2)
        expect(skipping.print).toHaveBeenCalledWith("chatbot agent agent-1 live, graph created, 1 connections assigned")
    })
})
