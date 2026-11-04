import { mock } from "@starci/jest-preset"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { LedgerConnectionRefusedError, LedgerRegistry } from "@modules/domain/provider-registry"
import type { LedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import { LEDGER_MANIFEST, LedgerNativeService } from "./ledger-native.service"
import { NativeViewService } from "./native-view.service"

const CALLER = { agentId: "agent-1", conversationId: null }
const ENTRY: LedgerEntry = {
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

/** A ledger of graph-node effects that runs the act the first time a key is seen and answers the first subject afterwards. */
const effectsLedger = () => {
    const seen = new Map<string, { kind: string; id: string }>()
    const effects = mock<GraphNodeEffectsService>()
    effects.once.mockImplementation(async (_workspaceId, _effect, call, act) => {
        const before = seen.get(call.key)
        if (before !== undefined) return before
        const subject = await act()
        seen.set(call.key, subject)
        return subject
    })
    return effects
}

const build = (port: LedgerPort | null = portOf(true)) => {
    const views = mock<NativeViewService>()
    views.internalOf.mockResolvedValue(undefined as never)
    const providers = new LedgerRegistry()
    if (port !== null) providers.register(port)
    const effects = effectsLedger()
    return { service: new LedgerNativeService(views, providers, effects), views, effects, port }
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

describe("LedgerNativeService > status", () => {
    it("says whether a provider is ready in the workspace", async () => {
        const ready = build(portOf(true))
        const idle = build(portOf(false))
        const none = build(null)

        await expect(ready.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: true })
        await expect(idle.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: false })
        await expect(none.service.invoke("ws-1", "status", {}, CALLER)).resolves.toEqual({ connected: false })
        expect(ready.views.internalOf).toHaveBeenCalledWith("ws-1", CALLER)
    })
})

describe("LedgerNativeService > append and void", () => {
    it("appends the entry through the ready provider and answers its reference", async () => {
        const { service, port } = build()

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A2:G2",
        })
        expect(port?.append).toHaveBeenCalledWith("ws-1", ENTRY)
    })

    it("writes a transaction once: a replay, another run or a retry adds no second entry", async () => {
        const { service, port } = build()

        const first = await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)
        const again = await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)

        expect(again).toEqual(first)
        expect(port?.append).toHaveBeenCalledTimes(1)
    })

    it("takes a transaction back with one void, once", async () => {
        const { service, port, effects } = build()

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
        const { service, port } = build()

        await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)
        await service.invoke("ws-1", "append", { entry: { ...ENTRY, status: "void" } }, CALLER)

        expect(port?.append).toHaveBeenCalledTimes(2)
    })

    it.each(["append", "void"] as const)("is not connected for %s when no provider is ready", async (tool) => {
        const { service, port } = build(portOf(false))
        const args = tool === "append" ? { entry: ENTRY } : { transactionId: ENTRY.transactionId }

        await expect(service.invoke("ws-1", tool, args, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
        expect(port?.append).not.toHaveBeenCalled()
    })

    it("is not connected when the provider has nothing to write to after all", async () => {
        const port = portOf(true)
        port.append.mockResolvedValue(undefined)
        const { service } = build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
    })

    it("answers connection_refused when the provider refused the connection itself, and tries nothing again", async () => {
        const port = portOf(true)
        port.append.mockRejectedValue(new LedgerConnectionRefusedError("google"))
        const { service } = build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "connection_refused" },
        })
    })

    it("throws any other failure of the provider as it is, so the run tries again", async () => {
        const port = portOf(true)
        const timeout = new Error("timeout")
        port.append.mockRejectedValue(timeout)
        const { service } = build(port)

        await expect(service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)).rejects.toBe(timeout)
    })
})

describe("LedgerNativeService > refusals", () => {
    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service, port } = build()

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
        const views = mock<NativeViewService>()
        views.internalOf.mockResolvedValue(undefined as never)
        const providers = new LedgerRegistry()
        const port = portOf(true)
        providers.register(port)
        const service = new LedgerNativeService(views, providers)

        await service.invoke("ws-1", "append", { entry: ENTRY }, CALLER)

        expect(port.append).toHaveBeenCalledTimes(1)
    })
})
