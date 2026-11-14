import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ConnectionEntity } from "@modules/domain/connections/persistence/entities"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { AccountAttachmentsService, toolGrantsEntities } from "@modules/domain/tool-grants"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { NODE_REQUESTS_GATE } from "./node-requests.decorators"
import type { NodeRequestsGate, OptionalNodeRequest } from "./node-mode.policy"
import { AgentAccountsService } from "./agent-accounts.service"
import type { RightSeen } from "./right-origin.contracts"

/** The entities of the attachment store, as their owning capability registers them. */
const [, AccountAttachmentEntity] = toolGrantsEntities
type AttachmentRow = InstanceType<typeof AccountAttachmentEntity>

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

const rowOf = (agentId: string, connectionId: string, provider: string): AttachmentRow =>
    Object.assign(new AccountAttachmentEntity(), {
        id: `${agentId}:${connectionId}`,
        workspaceId: WS,
        agentId,
        connectionId,
        provider,
        updatedBy: "owner-1",
        isDefault: false,
    })

/** What a spec binds of the run's own records: the stored run (its trigger context) and the tool call log. */
interface RunReaders {
    /** The runs reader. */
    readonly runs?: AgentRunsService
    /** The call log. */
    readonly callLog?: ToolCallLogService
}

/**
 * The service over the real attachment store: the shop's `accounts`, the stored `rows`, and what the step's node declares (`request`: its
 * mode and providers, or null when it states none).
 */
const build = async (
    accounts: ReadonlyArray<Account> = ONE_EACH,
    rows: ReadonlyArray<AttachmentRow> = [],
    request: OptionalNodeRequest = null,
    run: RunReaders = {},
) => {
    // Every account of this world is connected: the attachment read keeps only attachments to a live connection (R36).
    const live = [...new Set(rows.map((row) => row.connectionId))].map((id) => Object.assign(new ConnectionEntity(), { id }))
    const entityManager: MockEntityManager = mockEntityManager({
        find: [
            [AccountAttachmentEntity, [...rows]],
            [ConnectionEntity, live],
        ],
        insert: [AccountAttachmentEntity, {}],
    })
    const agents = mock<AgentDirectoryService>()
    agents.cardsOf.mockImplementation((_workspaceId, ids) =>
        Promise.resolve(ids.map((id) => ({ id, name: id, module: "sales" }))),
    )
    // The directory answers the ACTIVE agents only: "agent-removed" (a removed Sales copy) is not among them.
    agents.activeOf.mockResolvedValue(
        [
            ["agent-chatbot", "chatbot"],
            [SALES, "sales"],
            ["agent-hr", "hiring"],
        ].map(([id = "", module = ""]) => ({ id, name: id, module })),
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
    const gate = mock<NodeRequestsGate>()
    gate.requestOf.mockResolvedValue(request)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentAccountsService,
            AccountAttachmentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: NODE_REQUESTS_GATE, useValue: gate },
            ...(run.runs === undefined ? [] : [{ provide: AgentRunsService, useValue: run.runs }]),
            ...(run.callLog === undefined ? [] : [{ provide: ToolCallLogService, useValue: run.callLog }]),
        ],
    }).compile()
    return { service: moduleRef.get(AgentAccountsService), entityManager, gate }
}

const TARGET = { workspaceId: WS, agentId: SALES, moduleKey: "sales" }
const SEND = "nivo.tool.customer.message.send"
const QR_TOOL = "nivo.tool.payment.transfer.create"
const BANK_TOOL = "nivo.tool.bank.transaction.list"
const STEP = { nodeKey: "reply", versionId: "v-3", workflowId: "wf-1" }

/** A node of the given mode acting through Zalo OA. */
const zaloNodeOf = (mode: "auto" | "ask"): OptionalNodeRequest => ({
    mode,
    accounts: [{ kind: "messaging", provider: "zalo_oa", connectionId: null }],
})

/** A node of the given mode acting through SePay. */
const bankNodeOf = (mode: "auto" | "ask"): OptionalNodeRequest => ({
    mode,
    accounts: [{ kind: "payment", provider: "sepay", connectionId: null }],
})

/** Where a node's call came from, as the door and the executors state it. */
const FROM_NODE: RightSeen = { origin: "node", node: STEP }

describe("AgentAccountsService.attachmentOf: the kill switch is the attachment to the very account", () => {
    it("two Zalo OAs: a send reaches the OA the agent is attached to, and is not_attached on the other one", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa")])

        await expect(service.attachmentOf(WS, SALES, SEND, { provider: "zalo_oa", connectionId: "oa-1" })).resolves.toEqual({
            kind: "allow",
            provider: "zalo_oa",
            connectionId: "oa-1",
        })
        await expect(service.attachmentOf(WS, SALES, SEND, { provider: "zalo_oa", connectionId: "oa-2" })).resolves.toEqual({
            kind: "refuse",
            reason: "not_attached",
            providers: ["zalo_oa"],
            connectionId: "oa-2",
        })
    })

    it("any serving attachment counts when the call names no account; none is not_attached; a tool no provider serves is not judged", async () => {
        const attached = await build(ONE_EACH, [rowOf(SALES, "mb", "sepay")])
        await expect(attached.service.attachmentOf(WS, SALES, BANK_TOOL)).resolves.toMatchObject({ kind: "allow", connectionId: "mb" })

        const none = await build(ONE_EACH, [])
        await expect(none.service.attachmentOf(WS, SALES, BANK_TOOL)).resolves.toMatchObject({ kind: "refuse", reason: "not_attached" })
        await expect(none.service.attachmentOf(WS, SALES, "nivo.tool.brain.search")).resolves.toBeNull()
    })

    it("two SePay accounts: transactions are read on every account the agent is attached to", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "mb", "sepay"), rowOf(SALES, "vcb", "sepay")])

        await expect(service.accountsOfAgent(WS, SALES, BANK_TOOL)).resolves.toEqual(["mb", "vcb"])
        await expect(service.accountsOfAgent(WS, SALES, QR_TOOL)).resolves.toEqual(["mb", "vcb"])
        await expect(service.accountsOfAgent(WS, SALES, SEND)).resolves.toEqual([])
    })
})

describe("AgentAccountsService.judgeSend: the attachment to the very account; the node's mode is the door's", () => {
    const send = (step?: typeof STEP) => ({
        workspaceId: WS,
        agentId: SALES,
        effect: SEND,
        target: { provider: "zalo_oa", connectionId: "oa-1" },
        ...(step === undefined ? {} : { step }),
    })

    it("an attached agent's send is allowed whatever its node declares, and the node is never read (the tool door asks the mode)", async () => {
        const auto = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa")], zaloNodeOf("auto"))
        await expect(auto.service.judgeSend(send(STEP))).resolves.toEqual({ kind: "allow", provider: "zalo_oa", connectionId: "oa-1" })
        expect(auto.gate.requestOf).not.toHaveBeenCalled()

        const ask = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa")], zaloNodeOf("ask"))
        await expect(ask.service.judgeSend(send(STEP))).resolves.toEqual({ kind: "allow", provider: "zalo_oa", connectionId: "oa-1" })
        expect(ask.gate.requestOf).not.toHaveBeenCalled()
    })

    it("a detached agent is not_attached on that account, with or without a step", async () => {
        const detached = await build(TWO_EACH, [], zaloNodeOf("auto"))
        await expect(detached.service.judgeSend(send(STEP))).resolves.toMatchObject({ kind: "refuse", reason: "not_attached" })
        await expect(detached.service.judgeSend(send())).resolves.toMatchObject({ kind: "refuse", reason: "not_attached" })
        expect(detached.gate.requestOf).not.toHaveBeenCalled()
    })

    it("the engine's own line runs once attached, even under an ask node; detached it is refused", async () => {
        const ask = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa")], zaloNodeOf("ask"))
        await expect(ask.service.judgeEngineLine(send(STEP))).resolves.toEqual({ kind: "allow", provider: "zalo_oa", connectionId: "oa-1" })

        const detached = await build(TWO_EACH, [], zaloNodeOf("ask"))
        await expect(detached.service.judgeEngineLine(send(STEP))).resolves.toMatchObject({ kind: "refuse", reason: "not_attached" })
    })
})

describe("AgentAccountsService defaults: attach the template's providers' working accounts", () => {
    it("attaches a fresh agent to every working account of a provider its template lists, and to none that is not connected", async () => {
        const { service, entityManager } = await build()

        await expect(service.attachDefaults(TARGET, null, null)).resolves.toEqual({
            ok: true,
            attached: [
                { connectionId: "oa-1", provider: "zalo_oa" },
                { connectionId: "mb", provider: "sepay" },
            ],
        })
        expect(entityManager.insert).toHaveBeenCalledWith(AccountAttachmentEntity, [
            { workspaceId: WS, agentId: SALES, connectionId: "oa-1", provider: "zalo_oa", updatedBy: null },
            { workspaceId: WS, agentId: SALES, connectionId: "mb", provider: "sepay", updatedBy: null },
        ])
    })

    it("never touches an attachment the shop holds, and fills only the accounts the agent is not attached to", async () => {
        const held = await build(ONE_EACH, [rowOf(SALES, "oa-1", "zalo_oa"), rowOf(SALES, "mb", "sepay")])
        await expect(held.service.attachDefaults(TARGET, null, null)).resolves.toEqual({ ok: true, attached: [] })
        expect(held.entityManager.insert).not.toHaveBeenCalled()
        expect(held.entityManager.update).not.toHaveBeenCalled()
        expect(held.entityManager.delete).not.toHaveBeenCalled()

        const partly = await build(TWO_EACH, [rowOf(SALES, "oa-1", "zalo_oa")])
        const made = await partly.service.attachDefaults(TARGET, null, null)
        expect(made.ok && made.attached.map((entry) => entry.connectionId)).toEqual(["oa-2", "mb", "vcb"])
    })

    it("takes the owner's edit of the proposal, keyed by account, and writes nothing when one entry cannot be stored", async () => {
        const { service, entityManager } = await build()

        await expect(service.attachDefaults(TARGET, [{ connectionId: "oa-1" }], "owner-1")).resolves.toEqual({
            ok: true,
            attached: [{ connectionId: "oa-1", provider: "zalo_oa" }],
        })

        entityManager.insert.mockClear()
        await expect(service.wishProblem(WS, [{ connectionId: "tg" }])).resolves.toBe("not_connected")
        await expect(service.wishProblem(WS, [{ connectionId: "nowhere" }])).resolves.toBe("unknown_account")
        await expect(service.attachDefaults(TARGET, [{ connectionId: "oa-1" }, { connectionId: "tg" }], "owner-1")).resolves.toEqual({
            ok: false,
            reason: "not_connected",
        })
        expect(entityManager.insert).not.toHaveBeenCalled()
    })
})

describe("AgentAccountsService board and templates", () => {
    it("shows each provider once with the tools it serves, the shop's accounts of it, and every attachment", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "vcb", "sepay")])

        const board = await service.board(WS)

        const sepay = board.providers.find((entry) => entry.provider === "sepay")
        expect(sepay?.abilities.map((ability) => ability.id)).toEqual(["transactions.read", "transfer.instruction"])
        expect(sepay?.accounts).toEqual([
            { connectionId: "mb", provider: "sepay", label: "mb account", connected: true },
            { connectionId: "vcb", provider: "sepay", label: "vcb account", connected: true },
        ])
        expect(board.providers.find((entry) => entry.provider === "meta")).toMatchObject({ connected: false, accounts: [] })
        expect(board.attachments).toEqual([{ agentId: SALES, connectionId: "vcb", provider: "sepay" }])
    })

    it("proposes one line per working account of a listed provider, and a bare line for one that is not connected", async () => {
        const { service } = await build([...TWO_EACH, ["tg", "telegram", "pending"]])

        await expect(service.templateProposal(WS, "sales")).resolves.toEqual([
            { provider: "zalo_oa", connectionId: "oa-1", accountLabel: "oa-1 account", connected: true },
            { provider: "zalo_oa", connectionId: "oa-2", accountLabel: "oa-2 account", connected: true },
            { provider: "telegram", connectionId: null, accountLabel: null, connected: false },
            { provider: "meta", connectionId: null, accountLabel: null, connected: false },
            { provider: "sepay", connectionId: "mb", accountLabel: "mb account", connected: true },
            { provider: "sepay", connectionId: "vcb", accountLabel: "vcb account", connected: true },
            { provider: "casso", connectionId: null, accountLabel: null, connected: false },
            { provider: "payos", connectionId: null, accountLabel: null, connected: false },
        ])
    })

    it("lists, for an account connected later, the active agents its template names that are not attached to THAT account", async () => {
        const { service, entityManager } = await build(TWO_EACH, [rowOf("agent-chatbot", "oa-1", "zalo_oa"), rowOf(SALES, "oa-1", "zalo_oa")])

        await expect(service.templateCandidates(WS, "oa-1")).resolves.toEqual([])
        await expect(service.templateCandidates(WS, "oa-2")).resolves.toEqual([
            { agentId: "agent-chatbot", agentName: "agent-chatbot", module: "chatbot" },
            { agentId: SALES, agentName: SALES, module: "sales" },
        ])
        await expect(service.attachByTemplate(WS, "oa-2", [SALES, "agent-hr", "agent-removed"], "owner-1")).resolves.toEqual([SALES])
        expect(entityManager.insert).toHaveBeenCalledWith(AccountAttachmentEntity, [
            { workspaceId: WS, connectionId: "oa-2", provider: "zalo_oa", agentId: SALES, updatedBy: "owner-1" },
        ])
        await expect(service.attachByTemplate(WS, "nowhere", [SALES], "owner-1")).resolves.toEqual({ ok: false, reason: "unknown_account" })
    })
})

describe("AgentAccountsService: attach and detach", () => {
    it("attaches once (a second attach is already_attached) and detach is the kill switch (not_attached once gone)", async () => {
        const fresh = await build(ONE_EACH, [])
        fresh.entityManager.findOne.mockResolvedValue(null)
        await expect(fresh.service.attach({ workspaceId: WS, agentId: SALES }, { connectionId: "mb" }, "owner-1")).resolves.toEqual({ ok: true })

        const held = await build(ONE_EACH, [rowOf(SALES, "mb", "sepay")])
        held.entityManager.findOne.mockResolvedValue(rowOf(SALES, "mb", "sepay"))
        await expect(held.service.attach({ workspaceId: WS, agentId: SALES }, { connectionId: "mb" }, "owner-1")).resolves.toEqual({
            ok: false,
            reason: "already_attached",
        })

        held.entityManager.delete.mockResolvedValue({ affected: 1, raw: [] })
        await expect(held.service.detach(WS, SALES, "mb")).resolves.toEqual({ ok: true })
        held.entityManager.delete.mockResolvedValue({ affected: 0, raw: [] })
        await expect(held.service.detach(WS, SALES, "mb")).resolves.toEqual({ ok: false, reason: "not_attached" })
    })
})

describe("AgentAccountsService: the accounts of a step are the node's providers, in its order", () => {
    const NODE_ACCOUNTS: ReadonlyArray<Account> = [["vcb", "sepay", "connected"]]
    const NODE_ROWS = [rowOf(SALES, "vcb", "sepay")]

    it("binds the agent's one attached account of each provider the node lists, and none of a provider it does not list", async () => {
        const { service } = await build(NODE_ACCOUNTS, NODE_ROWS, bankNodeOf("auto"))

        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
        await expect(service.accountsOfAgent(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual(["vcb"])
        await expect(service.listsProviders(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toBe(true)

        const elsewhere = await build(NODE_ACCOUNTS, NODE_ROWS, {
            mode: "auto",
            accounts: [{ kind: "books", provider: "google", connectionId: null }],
        })
        await expect(elsewhere.service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual([])
        await expect(elsewhere.service.listsProviders(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toBe(false)
    })

    it("of two attached accounts of one provider binds none (it needs a pick)", async () => {
        const { service } = await build(TWO_EACH, [rowOf(SALES, "mb", "sepay"), rowOf(SALES, "vcb", "sepay")], bankNodeOf("auto"))
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual([])
    })

    it("binds nothing at a step whose node cannot be read, and every serving account outside a step", async () => {
        const { service } = await build(NODE_ACCOUNTS, NODE_ROWS, null)

        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual([])
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
    })
})

describe("AgentAccountsService: which of two accounts of one provider a step's call uses", () => {
    const rows = (defaultId: string | null) => [
        Object.assign(rowOf(SALES, "mb", "sepay"), { isDefault: defaultId === "mb" }),
        Object.assign(rowOf(SALES, "vcb", "sepay"), { isDefault: defaultId === "vcb" }),
    ]
    const RUN = { runId: "run-1" }
    const readers = (trigger: string | undefined, used: ReadonlyArray<string>) => {
        const runs = mock<AgentRunsService>()
        runs.runOf.mockResolvedValue({
            id: "run-1",
            workspaceId: WS,
            agentId: SALES,
            wakeId: "wake-1",
            trigger: "start",
            versionId: null,
            status: "running",
            context: trigger === undefined ? {} : { connectionId: trigger },
            errorCode: null,
            spoken: false,
        })
        const callLog = mock<ToolCallLogService>()
        callLog.connectionsUsedByRun.mockResolvedValue(used)
        return { runs, callLog }
    }
    const bound = (defaultId: string | null, trigger: string | undefined, used: ReadonlyArray<string>) =>
        build(TWO_EACH, rows(defaultId), bankNodeOf("auto"), readers(trigger, used))

    it("(1) binds the account the run's trigger came in on, over the run's earlier calls and the default", async () => {
        const { service } = await bound("mb", "vcb", ["mb"])
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
        await expect(service.pickNeeded(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toBeNull()
    })

    it("(2) binds an account the run already used when its trigger names none of them, over the default", async () => {
        const { service } = await bound("mb", "elsewhere", ["vcb", "mb"])
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
        const quiet = await bound("mb", undefined, ["vcb"])
        await expect(quiet.service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
    })

    it("(3) binds the agent's default account of the provider when the run names none, and hands the account without the flag", async () => {
        const { service } = await bound("vcb", undefined, [])
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
        // Without the run at all (a caller that knows none) the default still decides.
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
    })

    it("(4) binds none and names the choice when nothing picks: the provider and its candidate accounts", async () => {
        const { service } = await bound(null, undefined, [])
        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([])
        await expect(service.pickNeeded(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual({
            provider: "sepay",
            connectionIds: ["mb", "vcb"],
        })
        // Outside a step there is no node to name a provider: nothing is to pick.
        await expect(service.pickNeeded(WS, SALES, BANK_TOOL)).resolves.toBeNull()
    })

    it("keeps the single-account path as it was: the one account binds, and the run's records are never read", async () => {
        const one = readers("mb", ["mb"])
        const { service } = await build(TWO_EACH, [rowOf(SALES, "vcb", "sepay")], bankNodeOf("auto"), one)

        await expect(service.boundAccountsOf(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toEqual([{ provider: "sepay", connectionId: "vcb" }])
        await expect(service.pickNeeded(WS, SALES, BANK_TOOL, FROM_NODE, RUN)).resolves.toBeNull()
        expect(one.runs.runOf).not.toHaveBeenCalled()
        expect(one.callLog.connectionsUsedByRun).not.toHaveBeenCalled()
    })

    it("makes an attachment the default through the store and refuses an account the agent is not attached to", async () => {
        const { service, entityManager } = await build(TWO_EACH, rows(null))
        const inside = mockEntityManager({ update: [AccountAttachmentEntity, { affected: 1, raw: [], generatedMaps: [] }] })
        inside.findOne.mockResolvedValueOnce(rowOf(SALES, "vcb", "sepay")).mockResolvedValueOnce(null)
        entityManager.transaction.mockImplementation((first: unknown, second?: unknown) => {
            const work = (typeof first === "function" ? first : second) as (scoped: MockEntityManager) => Promise<unknown>
            return work(inside)
        })

        await expect(service.setDefault({ workspaceId: WS, agentId: SALES }, "vcb", "owner-1")).resolves.toEqual({ ok: true })
        await expect(service.setDefault({ workspaceId: WS, agentId: SALES }, "nope", "owner-1")).resolves.toEqual({
            ok: false,
            reason: "not_attached",
        })
    })
})
