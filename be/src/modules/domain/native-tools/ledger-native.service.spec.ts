import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ConnectionBindingsReadService, isProvider, type ConnectionRecord, type ConnectionStatusFacts } from "@modules/domain/connections"
import { GRAPH_EFFECT_ONCE } from "@modules/domain/graph-nodes"
import type { EffectOnce } from "@modules/domain/graph-nodes"
import { ToolsErrorCode } from "@modules/domain/tools"
import {
    LedgerRegistryService,
    ProviderRegistryError,
    ProviderRegistryErrorCode,
} from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import { DOOR_GRANTS } from "@modules/domain/entity-engine-door"
import { domainNameIn } from "@modules/domain/tools"
import type { WorkspaceToolFamily } from "@modules/domain/tools"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { LEDGER_MANIFEST, LedgerNativeService } from "./ledger-native.service"
import { NativeViewService } from "./native-view.service"
import type { NativeView } from "./native-view.policy"

// The engine's own caller (the declared job `accounting.ledger-append`): the caller that writes with no account handed. An agent's
// write with none handed is refused (ARCH-REVIEW 2026-11-12 S7, "no silent pick" below).

/** The account of a provider: ids are `<provider>-<n>` so the bindings double reads the provider off an id. */
const accountOf = (id: string, sandbox = false): ConnectionRecord => {
    const provider = id.split("-")[0] ?? ""
    if (!isProvider(provider)) throw new Error(`The spec id ${id} names no provider.`)
    return connectionRecord({ id, provider, workspaceId: "ws-1", sandbox })
}

/** The status facts of one account the bindings lister answers (only the id matters to the ledger). */
const factsOf = (id: string, provider: string): ConnectionStatusFacts => ({
    id,
    provider,
    name: id,
    status: "connected",
    createdAt: new Date(0),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
})

/**
 * The registry and bindings doubles serving these ports: each provider has one account `<provider>-1`, the registry hands the port of
 * the account's provider (`portFor`), and `recordOf` answers any `<provider>-<n>` id as that provider's account.
 */
/** What the registry's port lookup reads of an account (its provider and its sandbox flag). */
type PortAccountOf = Parameters<LedgerRegistryService["portFor"]>[0]

const servedBy = (
    registry: jest.Mocked<LedgerRegistryService>,
    bindings: jest.Mocked<ConnectionBindingsReadService>,
    ports: ReadonlyArray<LedgerPort>,
): void => {
    registry.providers.mockReturnValue(ports.map((port) => port.provider))
    registry.portFor.mockImplementation((account: PortAccountOf) => ports.find((port) => port.provider === account.provider))
    bindings.ofProvider.mockImplementation(async (_workspaceId: string, provider: string, _limit: number) =>
        ports.some((port) => port.provider === provider) ? [factsOf(`${provider}-1`, provider)] : [],
    )
    bindings.recordOf.mockImplementation(async (_workspaceId: string, id: string) => accountOf(id))
}

const CALLER = { agentId: "agent-1", conversationId: null, engine: true as const }
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
const actOnce = (effects: jest.Mocked<EffectOnce>): void => {
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
    bindings: jest.Mocked<ConnectionBindingsReadService>,
    port: LedgerPort | null,
): void => {
    views.internalOf.mockResolvedValue(mock<NativeView>())
    servedBy(providers, bindings, port === null ? [] : [port])
}

/** The ledger tools over the port, with the ledger of effects. */
const build = async (port: LedgerPort | null = portOf(true)) => {
    const views = mock<NativeViewService>()
    const providers = mock<LedgerRegistryService>()
    const bindings = mock<ConnectionBindingsReadService>()
    const effects = mock<EffectOnce>()
    arrange(views, providers, bindings, port)
    actOnce(effects)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LedgerNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: LedgerRegistryService, useValue: providers },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: GRAPH_EFFECT_ONCE, useValue: effects },
        ],
    }).compile()
    return { service: moduleRef.get(LedgerNativeService), views, effects, port, providers, bindings }
}

/** The ledger tools over the port in an app that binds no ledger of effects (no graph host). */
const buildBare = async (port: LedgerPort) => {
    const views = mock<NativeViewService>()
    const providers = mock<LedgerRegistryService>()
    const bindings = mock<ConnectionBindingsReadService>()
    arrange(views, providers, bindings, port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LedgerNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: LedgerRegistryService, useValue: providers },
            { provide: ConnectionBindingsReadService, useValue: bindings },
        ],
    }).compile()
    return { service: moduleRef.get(LedgerNativeService), port, providers, bindings }
}

describe("LedgerNativeService > the manifest", () => {
    it("names the capability by what it keeps, never by a provider, and is for internal callers only", () => {
        expect(LEDGER_MANIFEST.key).toBe("ledger")
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.name)).toEqual(["entry.append", "entry.void", "status.get"])
        for (const tool of LEDGER_MANIFEST.tools) expect(tool.internalOnly).toBe(true)
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.scope)).toEqual(["write", "write", "read"])
        expect(JSON.stringify(LEDGER_MANIFEST)).not.toMatch(/sheet|google|cell/iu)
    })
})

describe("LedgerNativeService > the door", () => {
    const connector: WorkspaceToolFamily = {
        manifest: LEDGER_MANIFEST,
        timeoutMs: 4000,
    }

    it("plays every ledger door tool the internal agent holds, so a job that calls `nivo.tool.ledger.status.get` or `nivo.tool.ledger.entry.append` finds its tool", () => {
        const ledgerGrants = DOOR_GRANTS.filter((tool) => tool.startsWith("nivo.tool.ledger."))
        expect(ledgerGrants).toEqual(["nivo.tool.ledger.entry.append", "nivo.tool.ledger.status.get"])
        for (const tool of ledgerGrants) expect(domainNameIn([connector], tool)).toBe(tool)
    })

    it("declares the domain of each of its tools", () => {
        expect(LEDGER_MANIFEST.tools.map((tool) => tool.domain)).toEqual([
            "nivo.tool.ledger.entry.append",
            "nivo.tool.ledger.entry.void",
            "nivo.tool.ledger.status.get",
        ])
    })
})

describe("LedgerNativeService > status", () => {
    it("says whether a provider is ready in the workspace", async () => {
        const ready = await build(portOf(true))
        const idle = await build(portOf(false))
        const none = await build(null)

        await expect(ready.service.invoke("ws-1", "status.get", {}, CALLER)).resolves.toEqual({ connected: true })
        await expect(idle.service.invoke("ws-1", "status.get", {}, CALLER)).resolves.toEqual({ connected: false })
        await expect(none.service.invoke("ws-1", "status.get", {}, CALLER)).resolves.toEqual({ connected: false })
        expect(ready.views.internalOf).toHaveBeenCalledWith("ws-1", CALLER)
    })
})

describe("LedgerNativeService > append and void", () => {
    it("appends the entry through the ready provider and answers its reference", async () => {
        const { service, port } = await build()

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A2:G2",
        })
        expect(port?.append).toHaveBeenCalledWith(accountOf("google-1"), ENTRY)
    })

    it("writes on the account the tool runner handed the call, through that account's provider alone", async () => {
        const { service, port } = await build()
        const handed = { ...CALLER, provider: port?.provider ?? "", connectionId: "google-2" }

        await service.invoke("ws-1", "entry.append", { entry: ENTRY }, handed)
        await expect(
            service.invoke("ws-1", "entry.append", { entry: ENTRY }, { ...handed, provider: "google_drive" }),
        ).rejects.toMatchObject({ params: { reason: "not_connected" } })

        expect(port?.append).toHaveBeenCalledWith(accountOf("google-2"), ENTRY)
        expect(port?.append).toHaveBeenCalledTimes(1)
    })

    it("writes a transaction once: a replay, another run or a retry adds no second entry", async () => {
        const { service, port } = await build()

        const first = await service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)
        const again = await service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)

        expect(again).toEqual(first)
        expect(port?.append).toHaveBeenCalledTimes(1)
    })

    it("takes a transaction back with one void, once", async () => {
        const { service, port, effects } = await build()

        await expect(service.invoke("ws-1", "entry.void", { transactionId: ENTRY.transactionId }, CALLER)).resolves.toEqual({
            ref: "Sheet1!A3:G3",
        })
        await service.invoke("ws-1", "entry.void", { transactionId: ENTRY.transactionId }, CALLER)

        expect(port?.void).toHaveBeenCalledTimes(1)
        expect(port?.void).toHaveBeenCalledWith(accountOf("google-1"), ENTRY.transactionId)
        expect(effects.once).toHaveBeenCalledWith(
            "ws-1",
            "ledger.write",
            { key: "ledger:sepay:95958515:void", dedupeKey: "ledger:sepay:95958515:void" },
            expect.any(Function),
        )
    })

    it("keeps the entry and its void apart, so a void is written after the entry", async () => {
        const { service, port } = await build()

        await service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)
        await service.invoke("ws-1", "entry.append", { entry: { ...ENTRY, status: "void" } }, CALLER)

        expect(port?.append).toHaveBeenCalledTimes(2)
    })

    it.each(["entry.append", "entry.void"] as const)("is not connected for %s when no provider is ready", async (tool) => {
        const { service, port } = await build(portOf(false))
        const args = tool === "entry.append" ? { entry: ENTRY } : { transactionId: ENTRY.transactionId }

        await expect(service.invoke("ws-1", tool, args, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
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

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
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

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "connection_refused" },
        })
    })

    it("throws any other failure of the provider as it is, so the run tries again", async () => {
        const port = portOf(true)
        const timeout = new Error("timeout")
        port.append.mockRejectedValue(timeout)
        const { service } = await build(port)

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)).rejects.toBe(timeout)
    })
})

describe("LedgerNativeService > refusals", () => {
    it("refuses arguments outside the schema and tools it does not have", async () => {
        const { service, port } = await build()

        await expect(
            service.invoke("ws-1", "entry.append", { entry: { ...ENTRY, date: "04/11/2026" } }, CALLER),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        await expect(
            service.invoke("ws-1", "entry.append", { entry: { ...ENTRY, sheetId: "x" } }, CALLER),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        // The engine builds no entry: a bank transaction named by its id alone is no argument of the tool.
        await expect(
            service.invoke("ws-1", "entry.append", { transactionId: ENTRY.transactionId }, CALLER),
        ).rejects.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        await expect(service.invoke("ws-1", "other", {}, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.UnknownTool,
        })
        expect(port?.append).not.toHaveBeenCalled()
    })

    it("never writes without the once-per-key ledger: an app that binds none refuses every write and still answers status", async () => {
        const port = portOf(true)
        const { service } = await buildBare(port)

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "ledger_key_unavailable" },
        })
        await expect(service.invoke("ws-1", "entry.void", { transactionId: ENTRY.transactionId }, CALLER)).rejects.toMatchObject({
            params: { reason: "ledger_key_unavailable" },
        })
        expect(port.append).not.toHaveBeenCalled()
        expect(port.void).not.toHaveBeenCalled()
        await expect(service.invoke("ws-1", "status.get", {}, CALLER)).resolves.toEqual({ connected: true })
    })

    it("keys the line by its transaction, whoever writes it: the step's and the job's append of one transaction are one key", async () => {
        const { service, effects, port } = await build()

        await service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)
        await service.invoke("ws-1", "entry.append", { entry: ENTRY }, { ...CALLER, engine: true })

        const key = `ledger:${ENTRY.transactionId}`
        expect(effects.once.mock.calls.map((call) => [call[1], call[2]])).toEqual([
            ["ledger.write", { key, dedupeKey: key }],
            ["ledger.write", { key, dedupeKey: key }],
        ])
        expect(port?.append).toHaveBeenCalledTimes(1)
    })
})

describe("LedgerNativeService > the account decides the port", () => {
    it("asks the registry for the port of each ACCOUNT, so a sandbox account reaches its sandbox port and a live one the live port", async () => {
        const live = portOf(true)
        const sandbox = { ...portOf(true), append: jest.fn().mockResolvedValue("Sheet1!A2:H2") }
        const { service, providers, bindings } = await build(live)
        const sandboxAccount = accountOf("google-9", true)
        bindings.recordOf.mockImplementation(async (_workspaceId: string, id: string) => (id === "google-9" ? sandboxAccount : accountOf(id)))
        providers.portFor.mockImplementation((account: PortAccountOf): LedgerPort => (account.sandbox ? sandbox : live))

        await expect(
            service.invoke("ws-1", "entry.append", { entry: ENTRY }, { ...CALLER, provider: "google", connectionId: "google-9" }),
        ).resolves.toEqual({ ref: "Sheet1!A2:H2" })

        expect(providers.portFor).toHaveBeenCalledWith(sandboxAccount)
        expect(sandbox.append).toHaveBeenCalledWith(sandboxAccount, ENTRY)
        expect(live.append).not.toHaveBeenCalled()
    })

    it("takes the first ready account of a provider, never an unready or a disconnected one", async () => {
        const port = portOf(true)
        port.ready.mockImplementation(async (account: ConnectionRecord) => account.id === "google-3")
        const { service, bindings } = await build(port)
        bindings.ofProvider.mockResolvedValue([factsOf("google-2", "google"), factsOf("google-3", "google"), factsOf("google-4", "google")])
        bindings.recordOf.mockImplementation(async (_workspaceId: string, id: string) =>
            id === "google-4" ? { ...accountOf(id), status: "disconnected" } : accountOf(id),
        )

        await service.invoke("ws-1", "entry.append", { entry: ENTRY }, CALLER)

        expect(port.append).toHaveBeenCalledWith(accountOf("google-3"), ENTRY)
    })

    it("refuses an account handed that belongs to another provider than the call names", async () => {
        const { service, port } = await build()

        await expect(
            service.invoke("ws-1", "entry.append", { entry: ENTRY }, { ...CALLER, provider: "google", connectionId: "google_drive-1" }),
        ).rejects.toMatchObject({ params: { reason: "not_connected" } })
        expect(port?.append).not.toHaveBeenCalled()
    })
})

// #10b (ARCH-REVIEW 2026-11-12 S7): no silent pick of the ledger. An agent's write the runner handed no account is refused
// `not_connected` (the runner hands the node's books account; with none it never takes "the first ready provider"); the engine's own
// caller (the declared job `accounting.ledger-append`) writes when exactly ONE provider is ready, is refused `not_selected` with
// several and `not_connected` with none. The status read covers every provider: no pick.
describe("LedgerNativeService > no silent pick", () => {
    const AGENT = { agentId: "agent-1", conversationId: null }
    const ENGINE = { ...AGENT, engine: true as const }
    const second = (): jest.Mocked<LedgerPort> => ({ ...portOf(true), provider: "google_drive" })

    it("an agent's write with no account handed: refused not_connected, nothing written", async () => {
        const { service, port } = await build()

        await expect(service.invoke("ws-1", "entry.append", { entry: ENTRY }, AGENT)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_connected" },
        })
        await expect(service.invoke("ws-1", "entry.void", { transactionId: ENTRY.transactionId }, AGENT)).rejects.toMatchObject({
            params: { reason: "not_connected" },
        })
        expect(port?.append).not.toHaveBeenCalled()
        expect(port?.void).not.toHaveBeenCalled()
    })

    it("the engine's write: the one ready provider; two ready, not_selected and nothing written", async () => {
        const one = await build()
        await expect(one.service.invoke("ws-1", "entry.append", { entry: ENTRY }, ENGINE)).resolves.toEqual({ ref: "Sheet1!A2:G2" })

        const two = await build()
        const other = second()
        const google = two.port
        servedBy(two.providers, two.bindings, google === null ? [other] : [google, other])
        await expect(two.service.invoke("ws-1", "entry.append", { entry: ENTRY }, ENGINE)).rejects.toMatchObject({
            params: { reason: "not_selected" },
        })
        expect(google?.append).not.toHaveBeenCalled()
        expect(other.append).not.toHaveBeenCalled()
        await expect(two.service.invoke("ws-1", "status.get", {}, ENGINE)).resolves.toEqual({ connected: true })
    })
})
