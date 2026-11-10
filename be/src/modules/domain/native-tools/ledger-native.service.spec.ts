import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import {
    LedgerRegistryService,
    ProviderRegistryError,
    ProviderRegistryErrorCode,
} from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import { DOOR_GRANTS } from "@modules/domain/entity-engine-door"
import { domainNameIn } from "@modules/domain/mcp-gateway"
import type { WorkspaceConnector } from "@modules/domain/mcp-gateway"
import type { EntityApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { LEDGER_MANIFEST, LedgerNativeService } from "./ledger-native.service"
import { NativeViewService } from "./native-view.service"
import type { NativeView } from "./native-view.policy"

const CALLER = { agentId: "agent-1", conversationId: null }
const ENTRY: BusinessLedgerEntry = {
    date: "2026-11-04",
    orderNo: "DH-7",
    customer: "Dinh",
    amountVnd: 5000,
    transactionId: "sepay:95958515",
    status: "paid",
    note: "",
}

const portOf = (ready: boolean): jest.Mocked<LedgerPort> => ({
    provider: "google",
    ready: jest.fn().mockResolvedValue(ready),
    append: jest.fn().mockResolvedValue("Sheet1!A2:G2"),
    void: jest.fn().mockResolvedValue("Sheet1!A3:G3"),
})

/** Makes the effects double a ledger that runs the act the first time a key is seen and answers the first subject afterwards. */
const actOnce = (effects: jest.Mocked<GraphNodeEffectsService>): void => {
    const seen = new Map<string, { kind: string; id: string }>()
    effects.once.mockImplementation(async (_workspaceId, _effect, call, act) => {
        const before = seen.get(call.key)
        if (before !== undefined) return before
        const subject = await act()
        seen.set(call.key, subject)
        return subject
    })
}

/** Arranges the view to let an internal caller in and the registry to hold `port` (none when null). */
const arrange = (
    views: jest.Mocked<NativeViewService>,
    providers: jest.Mocked<LedgerRegistryService>,
    port: LedgerPort | null,
): void => {
    views.internalOf.mockResolvedValue(mock<NativeView>())
    providers.all.mockReturnValue(port === null ? [] : [port])
}

/** The ledger tools over the port, with the ledger of effects. */
const build = async (port: LedgerPort | null = portOf(true)) => {
    const views = mock<NativeViewService>()
    const providers = mock<LedgerRegistryService>()
    const effects = mock<GraphNodeEffectsService>()
    arrange(views, providers, port)
    actOnce(effects)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LedgerNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: LedgerRegistryService, useValue: providers },
            { provide: GraphNodeEffectsService, useValue: effects },
        ],
    }).compile()
    return { service: moduleRef.get(LedgerNativeService), views, effects, port }
}

/** The ledger tools over the port in an app without the ledger of effects: every call writes. */
const buildBare = async (port: LedgerPort) => {
    const views = mock<NativeViewService>()
    const providers = mock<LedgerRegistryService>()
    arrange(views, providers, port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LedgerNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: LedgerRegistryService, useValue: providers },
        ],
    }).compile()
    return { service: moduleRef.get(LedgerNativeService), port }
}

describe("LedgerNativeService > the manifest", () => {
    it("names the capability by what it keeps, never by a provider, and is for internal callers only", () => {
        expect(LEDGER_MANIFEST.key).toBe("ledger")
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.name)).toEqual(["append", "void", "status"])
        for (const tool of LEDGER_MANIFEST.tools) expect(tool.internalOnly).toBe(true)
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.scope)).toEqual(["write", "write", "read"])
        expect(JSON.stringify(LEDGER_MANIFEST)).not.toMatch(/sheet|google|cell/iu)
    })
})

describe("LedgerNativeService > the door", () => {
    const connector: WorkspaceConnector = {
        manifest: LEDGER_MANIFEST,
        status: "active",
        url: null,
        credentialState: "none",
        credentialSetAt: null,
        timeoutMs: 4000,
        approvedTools: null,
        approvedAt: null,
        checkedAt: null,
    }

    it("plays every ledger door tool the internal agent holds, so a job that calls `ledger.status` or `ledger.append` finds its tool", () => {
        const ledgerGrants = DOOR_GRANTS.filter((tool) => tool.startsWith("ledger."))
        expect(ledgerGrants).toEqual(["ledger.append", "ledger.status"])
        for (const tool of ledgerGrants)
            expect(domainNameIn([connector], tool)).toBe(`ledger.${tool.slice("ledger.".length)}`)
    })

    it("declares the domain of each of its tools", () => {
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "ledger.append",
            "ledger.void",
            "ledger.status",
        ])
    })
})

describe("LedgerNativeService > status", () => {
    it("says whether a provider is ready in the workspace", async () => {
        const ready = await build(portOf(true))
        const idle = await build(portOf(false))
        const none = await build(null)

        await expect(ready.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: true })
        await expect(idle.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: false })
        await expect(none.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: false })
        expect(ready.views.internalOf).toHaveBeenCalledWith("ws-1", CALLER)
    })
})

describe("LedgerNativeService > append and void", () => {
    it("appends the entry through the ready provider and answers its reference", async () => {
        const { service, port } = await build()

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A2:G2",
        })
        expect(port?.append).toHaveBeenCalledWith("ws-1", ENTRY)
    })

    it("writes a transaction once: a replay, another run or a retry adds no second entry", async () => {
        const { service, port } = await build()

        const first = await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)
        const again = await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)

        expect(again).toEqual(first)
        expect(port?.append).toHaveBeenCalledTimes(1)
    })

    it("takes a transaction back with one void, once", async () => {
        const { service, port, effects } = await build()

        await expect(service.invoke("ws-1", "void", { transactionId: ENTRY.transactionId }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A3:G3",
        })
        await service.invoke("ws-1", "void", { transactionId: ENTRY.transactionId }, CALLER)

        expect(port?.void).toHaveBeenCalledTimes(1)
        expect(port?.void).toHaveBeenCalledWith("ws-1", ENTRY.transactionId)
        expect(effects.once).toHaveBeenCalledWith(
            "ws-1",
            "ledger.write",
            { key: "ledger:sepay:95958515:void", dedupeKey: "ledger:sepay:95958515:void" },
            expect.any(Function),
        )
    })

    it("keeps the entry and its void apart, so a void is written after the entry", async () => {
        const { service, port } = await build()

        await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)
        await service.invoke("ws-1", "append", { entry: { ...ENTRY, status: "void" } }, CALLER)

        expect(port?.append).toHaveBeenCalledTimes(2)
    })

    it.each(["append", "void"] as const)("is not connected for %s when no provider is ready", async (tool) => {
        const { service, port } = await build(portOf(false))
        const args = tool === "append" ? { entry: ENTRY } : { transactionId: ENTRY.transactionId }

        await expect(service.invoke("ws-1", tool, args, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
        expect(port?.append).not.toHaveBeenCalled()
    })
})

describe("LedgerNativeService > a provider that cannot write", () => {
    it("is not connected when the provider has nothing to write to after all", async () => {
        const port = portOf(true)
        port.append.mockResolvedValue(undefined)
        const { service } = await build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("answers connection_refused when the provider refused the connection itself, and tries nothing again", async () => {
        const port = portOf(true)
        port.append.mockRejectedValue(
            new ProviderRegistryError({
                code: ProviderRegistryErrorCode.LedgerConnectionRefused,
                params: { provider: "google" },
            }),
        )
        const { service } = await build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "connection_refused" },
        })
    })

    it("throws any other failure of the provider as it is, so the run tries again", async () => {
        const port = portOf(true)
        const timeout = new Error("timeout")
        port.append.mockRejectedValue(timeout)
        const { service } = await build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toBe(timeout)
    })
})

describe("LedgerNativeService > refusals", () => {
    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service, port } = await build()

        await expect(
            service.invoke("ws-1", "append", { entry: { ...ENTRY, date: "04/11/2026" } }, CALLER),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.InvalidArguments })
        await expect(
            service.invoke("ws-1", "append", { entry: { ...ENTRY, sheetId: "x" } }, CALLER),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.InvalidArguments })
        await expect(service.invoke("ws-1", "other", {}, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
        expect(port?.append).not.toHaveBeenCalled()
    })

    it("runs without the ledger of effects, writing every call", async () => {
        const port = portOf(true)
        const { service } = await buildBare(port)

        await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)

        expect(port.append).toHaveBeenCalledTimes(1)
    })
})

describe("LedgerNativeService > append by transaction id", () => {
    const TRANSACTION = "55555555-5555-4555-8555-555555555555"
    const ORDER = "44444444-4444-4444-8444-444444444444"
    const LEAD = "33333333-3333-4333-8333-333333333333"

    const recordOf = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
        id,
        workspaceId: "ws-1",
        version: "1",
        createdAt: "2026-11-04T03:00:00.000Z",
        updatedAt: "2026-11-04T03:00:00.000Z",
        data,
    })

    const pageOf = (rows: ReadonlyArray<RecordRow>, joined: Readonly<Record<string, string>> = {}): ListPage => ({
        rows: rows.map((row) => ({
            row,
            joined: Object.fromEntries(Object.entries(joined).map(([name, id]) => [name, { id, data: {} }])),
            position: [],
            included: {},
        })),
        next: null,
    })

    const buildWithRecords = async (orderId: string | null) => {
        const port = portOf(true)
        const views = mock<NativeViewService>()
        const providers = mock<LedgerRegistryService>()
        const engine = mock<EntityEngineService>()
        const ports = mock<EntityPortsService>()
        const transactions = mock<EntityApi>()
        const orders = mock<EntityApi>()
        const leads = mock<EntityApi>()
        arrange(views, providers, port)
        engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
        ports.entityApi.mockImplementation((_runIn, _by, entity) => {
            if (entity === "payment.transaction") return transactions
            return entity === "sales.order" ? orders : leads
        })
        transactions.get.mockResolvedValue(
            recordOf(TRANSACTION, {
                direction: "credit",
                amountVnd: 5000,
                reference: "DH7 thanh toan",
                payer: "DINH VAN A",
                orderId,
                occurredAt: "2026-11-04T03:00:00.000Z",
                status: orderId === null ? "unmatched" : "matched",
            }),
        )
        orders.list.mockResolvedValue(
            pageOf([recordOf(ORDER, { orderNo: "DH-7", amountVnd: 5000, status: "paid", leadId: LEAD })], { lead: LEAD }),
        )
        leads.get.mockResolvedValue(recordOf(LEAD, { contactName: "Dinh" }))
        leads.list.mockResolvedValue(pageOf([recordOf(LEAD, { contactName: "Dinh" })]))
        const moduleRef = await Test.createTestingModule({
            providers: [
                LedgerNativeService,
                { provide: NativeViewService, useValue: views },
                { provide: LedgerRegistryService, useValue: providers },
                { provide: EntityEngineService, useValue: engine },
                { provide: EntityPortsService, useValue: ports },
            ],
        }).compile()
        return { service: moduleRef.get(LedgerNativeService), port, engine }
    }

    it("builds the line from the transaction and the order it paid: the caller gives the id alone", async () => {
        const { service, port, engine } = await buildWithRecords(ORDER)

        await expect(service.invoke("ws-1", "append", { transactionId: TRANSACTION }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A2:G2",
        })
        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
        expect(port.append).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                orderNo: "DH-7",
                amountVnd: 5000,
                transactionId: TRANSACTION,
                status: "paid",
                direction: "in",
                category: "sale",
            }),
        )
    })

    it("refuses a transaction that paid nothing yet, one that is not there, and an id that is no record id; nothing is written", async () => {
        const unsettled = await buildWithRecords(null)
        await expect(unsettled.service.invoke("ws-1", "append", { transactionId: TRANSACTION }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
        await expect(unsettled.service.invoke("ws-1", "append", { transactionId: "tx-1" }, CALLER)).rejects.toMatchObject({
            params: { reason: "not_found" },
        })
        expect(unsettled.port.append).not.toHaveBeenCalled()
    })

    it("refuses arguments that name both a transaction and an entry", async () => {
        const { service } = await buildWithRecords(ORDER)
        await expect(
            service.invoke("ws-1", "append", { transactionId: TRANSACTION, entry: ENTRY }, CALLER),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.InvalidArguments })
    })
})
