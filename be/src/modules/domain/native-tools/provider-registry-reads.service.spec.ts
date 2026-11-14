import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentAccountsService } from "@modules/domain/tools"
import {
    PROVIDER_TRIGGER_CORE_DECIDERS,
    PROVIDER_TRIGGER_RECEIVERS,
    ProviderTriggersService,
    type ProviderTriggerCoreDeciders,
    type ProviderTriggerReceivers,
    type ProviderWake,
} from "@modules/domain/provider-triggers"
import { ProviderRegistryReadsService } from "./provider-registry-reads.service"

type Board = Awaited<ReturnType<AgentAccountsService["board"]>>
type Cards = Awaited<ReturnType<AgentDirectoryService["activeOf"]>>

/** A workspace with one SePay account: Accounting and a plugin agent attached, Sales not. */
const BOARD: Board = {
    providers: [
        {
            provider: "sepay",
            label: { vi: "SePay", en: "SePay" },
            kind: "payment",
            kindLabel: { vi: "Payment", en: "Payment" },
            connected: true,
            abilities: [
                {
                    id: "transactions.read",
                    label: { vi: "Read transactions", en: "Read transactions" },
                    scope: "read",
                    tools: ["nivo.tool.bank.transaction.list"],
                },
            ],
            accounts: [{ connectionId: "conn-1", provider: "sepay", label: "SePay", connected: true }],
        },
    ],
    attachments: [
        { agentId: "a-core", connectionId: "conn-1", provider: "sepay" },
        { agentId: "a-plugin", connectionId: "conn-1", provider: "sepay" },
        { agentId: "a-plugin", connectionId: "conn-2", provider: "sepay" },
    ],
}

const AGENTS: Cards = [
    { id: "a-core", name: "Accounting", module: "accounting" },
    { id: "a-sales", name: "Sales", module: "sales" },
    { id: "a-plugin", name: "Web books", module: "webbooks" },
]

const build = async (world: { readonly coreDecider?: string | null; readonly bound?: string | null } = {}) => {
    const abilities = mock<AgentAccountsService>()
    abilities.board.mockResolvedValue(BOARD)
    const triggers = mock<ProviderTriggersService>()
    triggers.switchesOf.mockResolvedValue([
        {
            name: "transaction.received",
            enabled: true,
            enabledAt: "2026-11-12T03:00:00.000Z",
            lastFiredAt: null,
            firedCount: 0,
            deciderAgentId: world.bound ?? null,
        },
    ])
    const receivers = mock<ProviderTriggerReceivers>()
    receivers.attachedTo.mockResolvedValue(["a-core", "a-plugin"])
    // The plugin agent registered on money in; the core agent registered on no provider trigger (its wake is the core path's).
    receivers.registered.mockImplementation((_workspaceId: string, agentId: string, wakes: ReadonlyArray<ProviderWake>) =>
        // Ledger (ROAD Opus-1f, R44): the sample's movement is in its `data`, as the event's generic scope carries it.
        Promise.resolve(wakes.map((wake) => agentId === "a-plugin" && Reflect.get(Object(wake.params.data), "direction") === "in")),
    )
    const coreDeciders = mock<ProviderTriggerCoreDeciders>()
    coreDeciders.coreDeciderOf.mockResolvedValue(world.coreDecider === undefined ? "a-core" : world.coreDecider)
    const agents = mock<AgentDirectoryService>()
    agents.activeOf.mockResolvedValue(AGENTS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderRegistryReadsService,
            { provide: AgentAccountsService, useValue: abilities },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: PROVIDER_TRIGGER_RECEIVERS, useValue: receivers },
            { provide: PROVIDER_TRIGGER_CORE_DECIDERS, useValue: coreDeciders },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    const service = moduleRef.get(ProviderRegistryReadsService)
    return { service, abilities, triggers, receivers }
}

describe("ProviderRegistryReadsService.configOf", () => {
    it("gives the switch of each trigger of the account with the agent that decides and whether another may be bound", async () => {
        const { service } = await build()

        await expect(service.configOf("ws-1", "sepay", "conn-1")).resolves.toEqual({
            connectionId: "conn-1",
            connected: true,
            triggers: [
                {
                    name: "transaction.received",
                    enabled: true,
                    enabledAt: "2026-11-12T03:00:00.000Z",
                    lastFiredAt: null,
                    firedCount: 0,
                    deciderAgentId: null,
                    decided: true,
                    coreDeciderAgentId: "a-core",
                    decidingAgentId: "a-core",
                    canCatchUp: true,
                },
            ],
        })
    })

    it("knows no account of another workspace or another provider", async () => {
        const { service } = await build()

        await expect(service.configOf("ws-1", "sepay", "conn-9")).resolves.toBeNull()
        await expect(service.configOf("ws-1", "imap", "conn-1")).resolves.toBeNull()
    })
})

describe("ProviderRegistryReadsService.rightsOf", () => {
    it("joins the attachments, the registrations and the decider: the core agent decides, the plugin agent is told, Sales holds nothing", async () => {
        const { service } = await build()

        await expect(service.rightsOf("ws-1", "sepay", "conn-1")).resolves.toEqual({
            connectionId: "conn-1",
            api: { viewers: "members" },
            agents: [
                {
                    agentId: "a-core",
                    name: "Accounting",
                    attached: true,
                    abilities: [{ id: "transactions.read", tools: ["nivo.tool.bank.transaction.list"], allowed: true }],
                    triggers: [{ name: "transaction.received", role: "decider" }],
                },
                {
                    agentId: "a-plugin",
                    name: "Web books",
                    attached: true,
                    abilities: [{ id: "transactions.read", tools: ["nivo.tool.bank.transaction.list"], allowed: true }],
                    triggers: [{ name: "transaction.received", role: "notice" }],
                },
                {
                    agentId: "a-sales",
                    name: "Sales",
                    attached: false,
                    abilities: [{ id: "transactions.read", tools: ["nivo.tool.bank.transaction.list"], allowed: false }],
                    triggers: [],
                },
            ],
        })
    })

    it("names the plugin agent the decider when the owner bound it and no core agent is", async () => {
        const { service } = await build({ coreDecider: null, bound: "a-plugin" })

        const rights = await service.rightsOf("ws-1", "sepay", "conn-1")

        expect(rights).toMatchObject({
            agents: [
                { agentId: "a-core", triggers: [] },
                { agentId: "a-plugin", triggers: [{ name: "transaction.received", role: "decider" }] },
                { agentId: "a-sales", triggers: [] },
            ],
        })
    })

    it("knows no account the workspace does not have", async () => {
        const { service } = await build()

        await expect(service.rightsOf("ws-1", "sepay", "conn-9")).resolves.toBeNull()
    })
})
