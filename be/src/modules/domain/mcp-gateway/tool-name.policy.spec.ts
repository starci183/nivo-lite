import { Test } from "@nestjs/testing"
import type { GatewayConnectorManifest, GatewayToolSpec, ToolGrant } from "./mcp-gateway.contracts"
import type { NativeAdapter } from "./mcp-gateway.contracts"
import {
    addressOf,
    duplicateNamesOf,
    fullNameOf,
    grantFor,
    namedToolIn,
    specOf,
    searchTools,
    toolNameOf,
    withUniqueNames,
} from "./tool-name.policy"

const toolSpec = (name: string, description: string, scope: GatewayToolSpec["scope"] = "read"): GatewayToolSpec => ({
    name,
    description,
    scope,
    inputSchema: {},
    defaultMode: "never",
})

/** A remote manifest of twelve tools for the specs. */
const MANIFEST: GatewayConnectorManifest = {
    key: "hakuen",
    name: "Back-office",
    kind: "remote",
    contractVersion: "back-office@1",
    tools: [
        toolSpec("rooms.searchAvailability", "Room types free for a date."),
        toolSpec("rates.quote", "Nightly price of a room type."),
        toolSpec("booking.hold", "Hold a room type.", "write"),
        toolSpec("booking.confirm", "Confirm a held booking.", "write"),
        toolSpec("booking.cancel", "Cancel a booking.", "write"),
        toolSpec("spa.findSlots", "Free spa slots for a service and date."),
        toolSpec("spa.hold", "Hold a spa slot.", "write"),
        toolSpec("spa.confirm", "Confirm a held spa booking.", "write"),
        toolSpec("stay.current", "The current stay of a guest."),
        toolSpec("keycode.reveal", "The key code of a stay.", "write"),
        toolSpec("folio.get", "The folio of a stay."),
        toolSpec("folio.recordPayment", "Record a payment.", "write"),
    ],
}

const grant = (tool: string, mode: ToolGrant["mode"], limits: Partial<ToolGrant> = {}): ToolGrant => ({
    tool,
    mode,
    limitVnd: null,
    constraints: [],
    ...limits,
})

/** The members of the subject under test. */
interface Subject {
    readonly addressOf: typeof addressOf
    readonly fullNameOf: typeof fullNameOf
    readonly grantFor: typeof grantFor
    readonly specOf: typeof specOf
    readonly searchTools: typeof searchTools
}

const SUBJECT = Symbol("tool-name.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { addressOf, fullNameOf, grantFor, specOf, searchTools } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("tool-name.policy", () => {
    it("splits a namespaced name and refuses anything else", async () => {
        const subject = await build()
        expect(subject.addressOf("hakuen.booking.hold")).toEqual({ connector: "hakuen", tool: "booking.hold" })
        expect(subject.addressOf("sepay.transactions.list")).toEqual({ connector: "sepay", tool: "transactions.list" })
        expect(subject.addressOf("booking")).toBeNull()
        expect(subject.addressOf("Hakuen.booking.hold")).toBeNull()
        expect(subject.fullNameOf("hakuen", "stay.current")).toBe("hakuen.stay.current")
    })

    it("prefers the exact grant over the connector wildcard", async () => {
        const subject = await build()
        const grants = [grant("hakuen.*", "auto"), grant("hakuen.keycode.reveal", "never")]
        expect(subject.grantFor(grants, "hakuen.keycode.reveal")?.mode).toBe("never")
        expect(subject.grantFor(grants, "hakuen.rates.quote")?.mode).toBe("auto")
        expect(subject.grantFor(grants, "sepay.transactions.list")).toBeNull()
        expect(subject.grantFor(grants, "bad")).toBeNull()
    })

    it("finds a spec by its local name", async () => {
        const subject = await build()
        expect(subject.specOf(MANIFEST, "spa.hold")?.scope).toBe("write")
        expect(subject.specOf(MANIFEST, "spa.nope")).toBeNull()
    })

    it("searches only granted tools, best match first, bounded", async () => {
        const subject = await build()
        const grants = [grant("hakuen.*", "auto"), grant("hakuen.keycode.reveal", "never")]
        const found = subject.searchTools([MANIFEST], grants, "spa slots", 3)
        expect(found[0]?.name).toBe("hakuen.spa.findSlots")
        expect(found.length).toBeLessThanOrEqual(3)
        expect(subject.searchTools([MANIFEST], grants, "key code", 10).map((tool) => tool.name)).not.toContain(
            "hakuen.keycode.reveal",
        )
        expect(subject.searchTools([MANIFEST], grants, "", 50)).toHaveLength(10)
        expect(subject.searchTools([MANIFEST], grants, "zzz", 0)).toEqual([])
        expect(subject.searchTools([MANIFEST], [], "", 5)).toEqual([])
    })
})

describe("tool-name.policy: full names through an index, not by the first dot", () => {
    const nivoContext: GatewayConnectorManifest = {
        key: "nivo-context",
        namespace: "nivo",
        name: "NIVO",
        kind: "native",
        contractVersion: "nivo-native@1",
        tools: [toolSpec("lead.order.list", "Orders."), toolSpec("conversation.message.list", "Thread.")],
    }
    const nivoBrain: GatewayConnectorManifest = { ...nivoContext, key: "nivo-brain", tools: [toolSpec("brain.change.propose", "Propose.", "write")] }
    const ledger: GatewayConnectorManifest = {
        key: "ledger",
        name: "Ledger",
        kind: "native",
        contractVersion: "ledger@1",
        tools: [toolSpec("append", "Append.", "write")],
    }
    const entries = [nivoContext, nivoBrain, ledger].map((manifest) => ({ manifest }))

    it("names a tool by its connector's public prefix, the key when it has none", () => {
        expect(toolNameOf(nivoContext, "lead.order.list")).toBe("nivo.lead.order.list")
        expect(toolNameOf(ledger, "append")).toBe("ledger.append")
    })

    it("resolves two connectors that share the `nivo` prefix, each to its own tool, and an old id beside them", () => {
        expect(namedToolIn(entries, "nivo.lead.order.list")?.connector.manifest.key).toBe("nivo-context")
        expect(namedToolIn(entries, "nivo.brain.change.propose")?.connector.manifest.key).toBe("nivo-brain")
        expect(namedToolIn(entries, "ledger.append")?.spec.name).toBe("append")
        expect(namedToolIn(entries, "nivo.ledger.append")).toBeNull()
        expect(namedToolIn(entries, "nivo-context.lead.order.list")).toBeNull()
    })

    it("refuses the start when two adapters hold one full name", () => {
        const adapterOf = (manifest: GatewayConnectorManifest): NativeAdapter =>
            ({ manifest, invoke: () => Promise.resolve({}) }) as unknown as NativeAdapter
        const twin: GatewayConnectorManifest = { ...nivoBrain, key: "nivo-twin", tools: [toolSpec("lead.order.list", "Again.")] }

        expect(duplicateNamesOf([nivoContext, nivoBrain, ledger])).toEqual([])
        expect(duplicateNamesOf([nivoContext, twin])).toEqual(["nivo.lead.order.list"])
        expect(() => withUniqueNames([adapterOf(nivoContext), adapterOf(twin)])).toThrow()
        expect(withUniqueNames([adapterOf(nivoContext), adapterOf(ledger)])).toHaveLength(2)
    })

    it("matches a wildcard grant by the longest prefix, and never by a bare `nivo.*`", () => {
        const g = (tool: string, mode: ToolGrant["mode"]): ToolGrant => ({ tool, mode, limitVnd: null, constraints: [] })
        const grants = [g("nivo.*", "auto"), g("nivo.lead.*", "never"), g("nivo.lead.order.*", "ask")]

        expect(grantFor(grants, "nivo.lead.order.list")?.mode).toBe("ask")
        expect(grantFor(grants, "nivo.lead.profile.get")?.mode).toBe("never")
        expect(grantFor(grants, "nivo.ledger.entry.append")).toBeNull()
        expect(grantFor([...grants, g("nivo.lead.order.list", "auto")], "nivo.lead.order.list")?.mode).toBe("auto")
        expect(grantFor([g("ledger.*", "auto")], "ledger.append")?.mode).toBe("auto")
    })
})
