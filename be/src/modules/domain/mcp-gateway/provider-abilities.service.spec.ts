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

/** The entities of the attachment store, as their owning capability registers them. */
const [, McpConnectorAccessEntity, McpDefaultAccountEntity] = mcpToolGrantsEntities
type AttachmentRow = InstanceType<typeof McpConnectorAccessEntity>

const WS = "ws-1"
const SALES = "agent-sales"

/** One connection of the shop: its id, provider and status. */
type Account = readonly [id: string, provider: string, status: string]

/** The dev shop: one Zalo OA, one SePay account and one Google account work; Telegram and payOS are still pending. */
const ONE_EACH: ReadonlyArray<Account> = [
    ["oa-1", "zalo_oa", "connected"],
    ["mb", "sepay", "connected"],
    ["sheet", "google", "connected"],
    ["tg", "telegram", "pending"],
    ["pay", "payos", "pending"],
]

/** A shop with two Zalo OAs and two SePay accounts. */
const TWO_EACH: ReadonlyArray<Account> = [
    ["oa-1", "zalo_oa", "connected"],
    ["oa-2", "zalo_oa", "connected"],
    ["mb", "sepay", "connected"],
    ["vcb", "sepay", "connected"],
]

const rowOf = (agentId: string, connectionId: string, provider: string, abilities: AbilityTicks): AttachmentRow =>
    Object.assign(new McpConnectorAccessEntity(), {
        id: `${agentId}:${connectionId}`,
        workspaceId: WS,
        agentId,
        connectionId,
        provider,
        abilities,
        updatedBy: "owner-1",
    })

/** The service over the real attachment store: the shop's `accounts`, the stored `rows`, and the default account the owner named. */
const build = async (
    accounts: ReadonlyArray<Account> = ONE_EACH,
    rows: ReadonlyArray<AttachmentRow> = [],
    namedDefault: string | null = null,
) => {
    const entityManager: MockEntityManager = mockEntityManager({
        find: [McpConnectorAccessEntity, [...rows]],
        insert: [McpConnectorAccessEntity, {}],
        upsert: [McpDefaultAccountEntity, {}],
    })
    entityManager.findOne.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === McpDefaultAccountEntity && namedDefault !== null ? { connectionId: namedDefault } : null),
    )
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockImplementation((_workspaceId, ids) =>
        Promise.resolve(ids.map((id) => ({ id, name: id, module: "sales", canTagAgentIds: [] }))),
    )
    // The directory answers the ACTIVE agents only: "agent-removed" (a removed Sales copy) is not among them.
    agents.activeOf.mockResolvedValue(
        [
            ["agent-chatbot", "chatbot"],
            [SALES, "sales"],
            ["agent-hr", "hiring"],
        ].map(([id = "", module = ""]) => ({ id, name: id, module, canTagAgentIds: [] })),
    )
    const connections = mock<ConnectionBindingsReadService>()
    connections.ofProvider.mockImplementation((_workspaceId, provider) =>
        Promise.resolve(
            accounts
                .filter((account) => account[1] === provider)
                .map(([id, , status]) => mock<ConnectionStatusFacts>({ id, name: `${id} account`, status, accountMasked: null })),
        ),
    )
    connections.recordOf.mockResolvedValue(null)
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
const SEND = "customer.message.send"

describe("ProviderAbilitiesService: a call is judged on the account it acts on", () => {
    it("two Zalo OAs: a send goes out on the OA the agent is attached to, and is refused on the other one", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa", { "customer.send": "auto" })])

        await expect(service.judge(WS, SALES, SEND, false, { provider: "zalo_oa", connectionId: "oa-1" })).resolves.toEqual({
            kind: "allow",
            provider: "zalo_oa",
            ability: "customer.send",
            connectionId: "oa-1",
        })
        await expect(service.judge(WS, SALES, SEND, false, { provider: "zalo_oa", connectionId: "oa-2" })).resolves.toEqual({
            kind: "refuse",
            reason: "not_attached",
            ability: "customer.send",
            providers: ["zalo_oa"],
            connectionId: "oa-2",
        })
    })

    it("two SePay accounts: transactions are read on every account the agent may read, and it is told which", async () => {
        const { service } = await build(TWO_EACH, [
            rowOf(SALES, "mb", "sepay", { "transactions.read": "auto" }),
            rowOf(SALES, "vcb", "sepay", { "transactions.read": "auto", "qr.create": "auto" }),
        ])

        await expect(service.judge(WS, SALES, "bank.transactions", false)).resolves.toMatchObject({ kind: "allow" })
        await expect(service.accountsOfAgent(WS, SALES, "bank.transactions")).resolves.toEqual(["mb", "vcb"])
        await expect(service.accountsOfAgent(WS, SALES, "payment.qr.create")).resolves.toEqual(["vcb"])
    })

    it("two SePay accounts: a QR is drawn only on the default receiving account, and needs the ability on that very account", async () => {
        const rows = [
            rowOf(SALES, "mb", "sepay", { "qr.create": "auto" }),
            rowOf(SALES, "vcb", "sepay", { "transactions.read": "auto" }),
        ]

        const onMb = await build(TWO_EACH, rows, "mb")
        await expect(onMb.service.judge(WS, SALES, "payment.qr.create", false)).resolves.toMatchObject({
            kind: "allow",
            connectionId: "mb",
        })

        const onVcb = await build(TWO_EACH, rows, "vcb")
        await expect(onVcb.service.judge(WS, SALES, "payment.qr.create", false)).resolves.toMatchObject({
            kind: "refuse",
            reason: "ability_off",
            connectionId: "vcb",
        })
    })

    it("never chooses between two payment accounts by itself: with no default named, the QR is refused with the fact", async () => {
        const { service } = await build(TWO_EACH, [
            rowOf(SALES, "mb", "sepay", { "qr.create": "auto" }),
            rowOf(SALES, "vcb", "sepay", { "qr.create": "auto" }),
        ])

        await expect(service.judge(WS, SALES, "payment.qr.create", false)).resolves.toEqual({
            kind: "refuse",
            reason: "no_default_account",
            ability: "qr.create",
            providers: ["sepay"],
        })
        await expect(service.defaultAccountOf(WS, "payment")).resolves.toBeNull()
    })

    it("takes the only working payment account as the default with nothing named, and ignores a named one that no longer works", async () => {
        const one = await build(ONE_EACH, [rowOf(SALES, "mb", "sepay", { "qr.create": "auto" })])
        await expect(one.service.defaultAccountOf(WS, "payment")).resolves.toBe("mb")
        await expect(one.service.judge(WS, SALES, "payment.qr.create", false)).resolves.toMatchObject({ kind: "allow" })

        const gone = await build(ONE_EACH, [], "old-account")
        await expect(gone.service.defaultAccountOf(WS, "payment")).resolves.toBe("mb")
    })

    it("lets the default be named only for a working account that can receive", async () => {
        const { service, entityManager } = await build(TWO_EACH)

        await expect(service.setDefaultAccount(WS, "vcb", "owner-1")).resolves.toEqual({ ok: true })
        expect(entityManager.upsert.mock.calls[0]?.[1]).toEqual({
            workspaceId: WS,
            kind: "payment",
            connectionId: "vcb",
            updatedBy: "owner-1",
        })
        await expect(service.setDefaultAccount(WS, "oa-1", "owner-1")).resolves.toEqual({ ok: false, reason: "no_default_ability" })
        await expect(service.setDefaultAccount(WS, "nowhere", "owner-1")).resolves.toEqual({ ok: false, reason: "unknown_account" })
        const pending = await build(ONE_EACH)
        await expect(pending.service.setDefaultAccount(WS, "tg", "owner-1")).resolves.toEqual({ ok: false, reason: "not_connected" })
    })
})

describe("ProviderAbilitiesService defaults", () => {
    it("attaches a fresh agent to every working account its module names, pre-ticked, and to none that is not connected", async () => {
        const { service, entityManager } = await build()

        await expect(service.attachDefaults(TARGET, null, null)).resolves.toEqual({
            ok: true,
            attached: [
                { connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "auto" } },
                { connectionId: "mb", provider: "sepay", abilities: { "qr.create": "auto" } },
            ],
        })
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { workspaceId: WS, agentId: SALES, connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "auto" }, updatedBy: null },
            { workspaceId: WS, agentId: SALES, connectionId: "mb", provider: "sepay", abilities: { "qr.create": "auto" }, updatedBy: null },
        ])
    })

    it("never overwrites a right the shop holds: Sales with qr.create unticked stays unticked through a reseed or a reset", async () => {
        const { service, entityManager } = await build(ONE_EACH, [
            rowOf(SALES, "oa-1", "zalo_oa", { "customer.send": "ask" }),
            rowOf(SALES, "mb", "sepay", {}),
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

    it("fills only the account the agent is not attached to, beside one the shop holds", async () => {
        const { service, entityManager } = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa", {})], "mb")

        const made = await service.attachDefaults(TARGET, null, null)

        expect(made.ok && made.attached.map((entry) => entry.connectionId)).toEqual(["oa-2", "mb"])
        expect(entityManager.insert).toHaveBeenCalledTimes(1)
        expect(entityManager.update).not.toHaveBeenCalled()
    })

    it("takes the owner's edit of the proposal, keyed by account, and writes nothing when one entry cannot be stored", async () => {
        const { service, entityManager } = await build()

        await expect(
            service.attachDefaults(TARGET, [{ connectionId: "oa-1", abilities: { "customer.send": "ask" } }], "owner-1"),
        ).resolves.toEqual({
            ok: true,
            attached: [{ connectionId: "oa-1", provider: "zalo_oa", abilities: { "customer.send": "ask" } }],
        })

        entityManager.insert.mockClear()
        await expect(service.wishProblem(WS, [{ connectionId: "tg", abilities: { "customer.send": "auto" } }])).resolves.toBe("not_connected")
        await expect(service.wishProblem(WS, [{ connectionId: "pay", abilities: {} }])).resolves.toBe("no_ability")
        await expect(service.wishProblem(WS, [{ connectionId: "nowhere", abilities: {} }])).resolves.toBe("unknown_account")
        await expect(service.wishProblem(WS, [{ connectionId: "mb", abilities: { "ledger.write": "auto" } }])).resolves.toBe("unknown_ability")
        expect(entityManager.insert).not.toHaveBeenCalled()
    })
})

describe("ProviderAbilitiesService: only the owner gives auto", () => {
    it("refuses a manager's auto on a write ability, at attach, at a tick and in an edited proposal, and takes ask, off and a read", async () => {
        const { service, entityManager } = await build()
        const auto = { connectionId: "oa-1", abilities: { "customer.send": "auto" } }

        await expect(service.attach({ workspaceId: WS, agentId: SALES }, auto, "m-1", "manager")).resolves.toEqual({
            ok: false,
            reason: "owner_only",
        })
        await expect(service.wishProblem(WS, [auto], "manager")).resolves.toBe("owner_only")
        await expect(service.wishProblem(WS, [auto], "owner")).resolves.toBeNull()
        await expect(service.wishProblem(WS, [{ connectionId: "oa-1", abilities: { "customer.send": "ask" } }], "manager")).resolves.toBeNull()
        await expect(service.wishProblem(WS, [{ connectionId: "mb", abilities: { "transactions.read": "auto" } }], "manager")).resolves.toBeNull()
        await expect(
            service.setAbility({ workspaceId: WS, agentId: SALES, connectionId: "mb" }, "qr.create", "auto", "m-1", "manager"),
        ).resolves.toEqual({ ok: false, reason: "owner_only" })
        expect(entityManager.insert).not.toHaveBeenCalled()
    })

    it("ticks a template's write abilities ask when a manager applies it: at creation and for an account connected later", async () => {
        const { service, entityManager } = await build()

        const made = await service.attachDefaults(TARGET, null, "m-1", "manager")
        expect(made.ok && made.attached.map((entry) => entry.abilities)).toEqual([{ "customer.send": "ask" }, { "qr.create": "ask" }])

        entityManager.insert.mockClear()
        await service.attachByTemplate(WS, "oa-1", ["agent-chatbot"], "m-1", "manager")
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { workspaceId: WS, connectionId: "oa-1", provider: "zalo_oa", agentId: "agent-chatbot", abilities: { "customer.send": "ask" }, updatedBy: "m-1" },
        ])
    })
})

describe("ProviderAbilitiesService board and templates", () => {
    it("shows each provider once with its abilities and the shop's accounts of it, the default receiving account marked", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "vcb", "sepay", { "qr.create": "auto" })], "vcb")

        const board = await service.board(WS)

        const sepay = board.providers.find((entry) => entry.provider === "sepay")
        expect(sepay?.abilities.map((ability) => ability.id)).toEqual(["transactions.read", "credit.rematch", "qr.create"])
        expect(sepay?.accounts).toEqual([
            { connectionId: "mb", provider: "sepay", label: "mb account", connected: true, isDefault: false },
            { connectionId: "vcb", provider: "sepay", label: "vcb account", connected: true, isDefault: true },
        ])
        expect(board.providers.find((entry) => entry.provider === "zalo_oa")?.accounts.map((account) => account.isDefault)).toEqual([false, false])
        expect(board.providers.find((entry) => entry.provider === "meta")).toMatchObject({ connected: false, accounts: [] })
        expect(board.attachments).toEqual([
            { agentId: SALES, connectionId: "vcb", provider: "sepay", abilities: { "qr.create": "auto" } },
        ])
    })

    it("proposes one line per working account, pre-ticked by the kind's template, and a bare line for a provider that is not connected", async () => {
        const { service } = await build([...TWO_EACH, ["tg", "telegram", "pending"]])

        await expect(service.templateProposal(WS, "sales")).resolves.toEqual([
            { provider: "zalo_oa", connectionId: "oa-1", accountLabel: "oa-1 account", connected: true, abilities: { "customer.send": "auto" } },
            { provider: "zalo_oa", connectionId: "oa-2", accountLabel: "oa-2 account", connected: true, abilities: { "customer.send": "auto" } },
            { provider: "telegram", connectionId: null, accountLabel: null, connected: false, abilities: {} },
            { provider: "meta", connectionId: null, accountLabel: null, connected: false, abilities: {} },
            { provider: "sepay", connectionId: "mb", accountLabel: "mb account", connected: true, abilities: {} },
            { provider: "sepay", connectionId: "vcb", accountLabel: "vcb account", connected: true, abilities: {} },
        ])
    })

    it("pre-ticks, of two payment accounts, only the default receiving one; the other is listed with nothing ticked and not attached by default", async () => {
        const { service } = await build(TWO_EACH, [], "vcb")

        const lines = await service.templateProposal(WS, "sales")
        expect(lines.filter((line) => line.provider === "sepay").map((line) => [line.connectionId, line.abilities])).toEqual([
            ["mb", {}],
            ["vcb", { "qr.create": "auto" }],
        ])
        const attached = await service.proposalOf(WS, "sales")
        expect(attached.map((entry) => entry.connectionId)).toEqual(["oa-1", "oa-2", "vcb"])
        await expect(service.templateCandidates(WS, "mb")).resolves.toEqual([])
        expect((await service.templateCandidates(WS, "vcb")).map((entry) => entry.agentId)).toEqual([SALES])
    })

    it("lists, for an account connected later, the agents its template names that are not attached to THAT account, and attaches only those asked", async () => {
        const { service, entityManager } = await build(TWO_EACH, [
            rowOf("agent-chatbot", "oa-1", "zalo_oa", { "customer.send": "auto" }),
            rowOf(SALES, "oa-1", "zalo_oa", { "customer.send": "auto" }),
        ])

        await expect(service.templateCandidates(WS, "oa-1")).resolves.toEqual([])
        await expect(service.templateCandidates(WS, "oa-2")).resolves.toEqual([
            { agentId: "agent-chatbot", agentName: "agent-chatbot", module: "chatbot", abilities: { "customer.send": "auto" } },
            { agentId: SALES, agentName: SALES, module: "sales", abilities: { "customer.send": "auto" } },
        ])
        await expect(service.attachByTemplate(WS, "oa-2", [SALES, "agent-hr", "agent-removed"], "owner-1")).resolves.toEqual([
            SALES,
        ])
        expect(entityManager.insert).toHaveBeenCalledWith(McpConnectorAccessEntity, [
            { workspaceId: WS, connectionId: "oa-2", provider: "zalo_oa", agentId: SALES, abilities: { "customer.send": "auto" }, updatedBy: "owner-1" },
        ])
        await expect(service.attachByTemplate(WS, "nowhere", [SALES], "owner-1")).resolves.toEqual({
            ok: false,
            reason: "unknown_account",
        })
    })

    it("proposes and attaches active agents only: a removed or paused agent is not a candidate and is passed over when asked for", async () => {
        const { service, entityManager } = await build(TWO_EACH)

        const candidates = await service.templateCandidates(WS, "oa-2")
        expect(candidates.map((entry) => entry.agentId)).toEqual(["agent-chatbot", SALES])
        await expect(service.attachByTemplate(WS, "oa-2", ["agent-removed"], "owner-1")).resolves.toEqual([])
        expect(entityManager.insert).not.toHaveBeenCalled()
    })

    it("names each account from what its connection stores", async () => {
        const { service } = await build(ONE_EACH)
        const board = await service.board(WS)

        expect(board.providers.find((entry) => entry.provider === "sepay")?.accounts[0]?.label).toBe("mb account")
    })
})
