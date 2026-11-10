import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { McpConnectorAccessService, mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"
import type { AbilityTicks } from "@modules/domain/mcp-tool-grants"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ProviderAbilitiesService } from "./provider-abilities.service"

/** The entity of the attachment table, as its owning capability registers it. */
const [, McpConnectorAccessEntity] = mcpToolGrantsEntities
type AttachmentRow = InstanceType<typeof McpConnectorAccessEntity>

const WS = "ws-1"
const SALES = "agent-sales"

/** The connections of the dev shop: Zalo OA, SePay and Google work; Telegram and payOS are still pending. */
const STATUS: Readonly<Record<string, string>> = {
    zalo_oa: "connected",
    sepay: "connected",
    google: "connected",
    telegram: "pending",
    payos: "pending",
}

const rowOf = (agentId: string, provider: string, abilities: AbilityTicks): AttachmentRow =>
    Object.assign(new McpConnectorAccessEntity(), {
        id: `${agentId}:${provider}`,
        workspaceId: WS,
        agentId,
        provider,
        abilities,
        updatedBy: "owner-1",
    })

/** The service over the real attachment store, whose table holds `rows`. */
const build = async (rows: ReadonlyArray<AttachmentRow> = []) => {
    const entityManager: MockEntityManager = mockEntityManager({
        find: [McpConnectorAccessEntity, [...rows]],
        insert: [McpConnectorAccessEntity, {}],
    })
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockImplementation((_workspaceId, ids) =>
        Promise.resolve(ids.map((id) => ({ id, name: id, module: "sales", canTagAgentIds: [] }))),
    )
    agents.moduleRefsOf.mockResolvedValue([
        { id: "agent-chatbot", module: "chatbot" },
        { id: SALES, module: "sales" },
        { id: "agent-hr", module: "hiring" },
    ])
    const connections = mock<ConnectionBindingsReadService>()
    connections.ofProvider.mockImplementation((_workspaceId, provider) => {
        const status = STATUS[provider]
        return Promise.resolve(
            status === undefined ? [] : [mock<ConnectionStatusFacts>({ id: provider, name: `${provider} account`, status })],
        )
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderAbilitiesService,
            McpConnectorAccessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(ProviderAbilitiesService), entityManager }
}

const TARGET = { workspaceId: WS, agentId: SALES, moduleKey: "sales" }

describe("ProviderAbilitiesService defaults", () => {
    it("attaches a fresh agent to the connected providers its module names, pre-ticked, and to no provider that is not connected", async () => {
        const { service, entityManager } = await build()

        await expect(service.attachDefaults(TARGET, null, null)).resolves.toEqual({
            ok: true,
            attached: [
                { provider: "zalo_oa", abilities: { "customer.send": "auto" } },
                { provider: "sepay", abilities: { "qr.create": "auto" } },
            ],
        })
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { workspaceId: WS, agentId: SALES, provider: "zalo_oa", abilities: { "customer.send": "auto" }, updatedBy: null },
            { workspaceId: WS, agentId: SALES, provider: "sepay", abilities: { "qr.create": "auto" }, updatedBy: null },
        ])
    })

    it("never overwrites a right the shop holds: Sales with qr.create unticked stays unticked through a reseed or a reset", async () => {
        const { service, entityManager } = await build([
            rowOf(SALES, "zalo_oa", { "customer.send": "ask" }),
            rowOf(SALES, "sepay", {}),
        ])

        await expect(service.attachDefaults(TARGET, null, null)).resolves.toEqual({ ok: true, attached: [] })

        expect(entityManager.insert).not.toHaveBeenCalled()
        expect(entityManager.update).not.toHaveBeenCalled()
        expect(entityManager.upsert).not.toHaveBeenCalled()
        expect(entityManager.save).not.toHaveBeenCalled()
        expect(entityManager.delete).not.toHaveBeenCalled()
        await expect(service.judge(WS, SALES, "payment.qr.create", false)).resolves.toMatchObject({
            kind: "refuse",
            reason: "ability_off",
        })
    })

    it("fills only the attachment that is absent beside one the shop holds", async () => {
        const { service, entityManager } = await build([rowOf(SALES, "sepay", {})])

        await expect(service.attachDefaults(TARGET, null, null)).resolves.toEqual({
            ok: true,
            attached: [{ provider: "zalo_oa", abilities: { "customer.send": "auto" } }],
        })
        expect(entityManager.insert).toHaveBeenCalledTimes(1)
        expect(entityManager.update).not.toHaveBeenCalled()
    })

    it("takes the owner's edit of the proposal instead of the template, and writes nothing when one entry cannot be stored", async () => {
        const { service, entityManager } = await build()

        await expect(
            service.attachDefaults(TARGET, [{ provider: "zalo_oa", abilities: { "customer.send": "ask" } }], "owner-1"),
        ).resolves.toEqual({ ok: true, attached: [{ provider: "zalo_oa", abilities: { "customer.send": "ask" } }] })

        entityManager.insert.mockClear()
        await expect(
            service.attachDefaults(TARGET, [{ provider: "telegram", abilities: { "customer.send": "auto" } }], "owner-1"),
        ).resolves.toEqual({ ok: false, reason: "not_connected" })
        await expect(service.wishProblem(WS, [{ provider: "payos", abilities: {} }])).resolves.toBe("no_ability")
        await expect(service.wishProblem(WS, [{ provider: "sepay", abilities: { "ledger.write": "auto" } }])).resolves.toBe(
            "unknown_ability",
        )
        expect(entityManager.insert).not.toHaveBeenCalled()
    })
})

describe("ProviderAbilitiesService: only the owner gives auto", () => {
    it("refuses a manager's auto on a write ability, at attach, at a tick and in an edited proposal, and takes ask and off", async () => {
        const { service, entityManager } = await build()
        const auto = { provider: "zalo_oa", abilities: { "customer.send": "auto" } }
        const ask = { provider: "zalo_oa", abilities: { "customer.send": "ask" } }

        await expect(service.attach({ workspaceId: WS, agentId: SALES }, auto, "m-1", "manager")).resolves.toEqual({
            ok: false,
            reason: "owner_only",
        })
        await expect(service.wishProblem(WS, [auto], "manager")).resolves.toBe("owner_only")
        await expect(service.wishProblem(WS, [auto], "owner")).resolves.toBeNull()
        await expect(service.wishProblem(WS, [ask], "manager")).resolves.toBeNull()
        await expect(
            service.setAbility({ workspaceId: WS, agentId: SALES, provider: "sepay" }, "qr.create", "auto", "m-1", "manager"),
        ).resolves.toEqual({ ok: false, reason: "owner_only" })
        expect(entityManager.insert).not.toHaveBeenCalled()
    })

    it("lets a manager tick a read ability, which only reads", async () => {
        const { service } = await build()

        await expect(
            service.wishProblem(WS, [{ provider: "sepay", abilities: { "transactions.read": "auto" } }], "manager"),
        ).resolves.toBeNull()
    })

    it("ticks a template's write abilities ask when a manager applies it: at creation and for a provider connected later", async () => {
        const { service, entityManager } = await build()

        await expect(service.attachDefaults(TARGET, null, "m-1", "manager")).resolves.toEqual({
            ok: true,
            attached: [
                { provider: "zalo_oa", abilities: { "customer.send": "ask" } },
                { provider: "sepay", abilities: { "qr.create": "ask" } },
            ],
        })
        entityManager.insert.mockClear()
        await service.attachByTemplate(WS, "zalo_oa", ["agent-chatbot"], "m-1", "manager")
        expect(entityManager.insert).toHaveBeenCalledWith(mcpToolGrantsEntities[1], [
            { workspaceId: WS, agentId: "agent-chatbot", provider: "zalo_oa", abilities: { "customer.send": "ask" }, updatedBy: "m-1" },
        ])
    })
})

describe("ProviderAbilitiesService board and templates", () => {
    it("shows every provider with whether it is connected and its account, and payOS with no ability", async () => {
        const { service } = await build([rowOf(SALES, "sepay", { "qr.create": "auto" })])

        const board = await service.board(WS)

        expect(board.providers.map((entry) => [entry.provider, entry.connected, entry.accountLabel])).toEqual([
            ["zalo_oa", true, "zalo_oa account"],
            ["telegram", false, null],
            ["meta", false, null],
            ["sepay", true, "sepay account"],
            ["payos", false, null],
            ["google", true, "google account"],
        ])
        expect(board.providers.find((entry) => entry.provider === "payos")?.abilities).toEqual([])
        expect(board.attachments).toEqual([{ agentId: SALES, provider: "sepay", abilities: { "qr.create": "auto" } }])
    })

    it("names every provider a module's template names, the unconnected ones marked", async () => {
        const { service } = await build()

        await expect(service.templateProposal(WS, "sales")).resolves.toEqual([
            { provider: "zalo_oa", abilities: { "customer.send": "auto" }, connected: true },
            { provider: "telegram", abilities: { "customer.send": "auto" }, connected: false },
            { provider: "meta", abilities: { "customer.send": "auto" }, connected: false },
            { provider: "sepay", abilities: { "qr.create": "auto" }, connected: true },
        ])
    })

    it("lists, for a provider connected later, the agents its template names that are not attached yet, and attaches only those asked", async () => {
        const { service, entityManager } = await build([rowOf("agent-chatbot", "zalo_oa", { "customer.send": "auto" })])

        await expect(service.templateCandidates(WS, "zalo_oa")).resolves.toEqual([
            { agentId: SALES, agentName: SALES, module: "sales", abilities: { "customer.send": "auto" } },
        ])
        await expect(service.attachByTemplate(WS, "zalo_oa", [SALES, "agent-hr"], "owner-1")).resolves.toEqual([SALES])
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { workspaceId: WS, agentId: SALES, provider: "zalo_oa", abilities: { "customer.send": "auto" }, updatedBy: "owner-1" },
        ])
        await expect(service.attachByTemplate(WS, "telegram", [SALES], "owner-1")).resolves.toEqual({
            ok: false,
            reason: "not_connected",
        })
    })
})
