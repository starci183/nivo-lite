import { Test } from "@nestjs/testing"
import type { ToolManifest, ManifestTool, ToolGrant } from "./tools.contracts"
import type { NativeToolFamily } from "./tools.contracts"
import {
    addressOf,
    duplicateNamesOf,
    fullNameOf,
    grantFor,
    isBareWildcard,
    namedToolIn,
    specOf,
    toolNameOf,
    withUniqueNames,
} from "./tool-name.policy"
import { toolArgumentsSchema } from "./tool-arguments.schema"

/** An id from its segments: a retired or malformed id is named on purpose here, never written whole. */
const dotted = (...segments: ReadonlyArray<string>): string => segments.join(".")

const toolSpec = (name: string, description: string, scope: ManifestTool["scope"] = "read"): ManifestTool => ({
    name,
    description,
    scope,
    inputSchema: {},
    defaultMode: "ask",
    argumentSchema: toolArgumentsSchema,
})

/** A manifest of twelve tools for the specs. */
const MANIFEST: ToolManifest = {
    key: "hakuen",
    name: "Back-office",
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
}

const SUBJECT = Symbol("tool-name.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { addressOf, fullNameOf, grantFor, specOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("tool-name.policy", () => {
    it("splits a namespaced name and refuses anything else", async () => {
        const subject = await build()
        expect(subject.addressOf("hakuen.booking.hold")).toEqual({ connector: "hakuen", tool: "booking.hold" })
        expect(subject.addressOf("nivo.tool.payment.credit.list")).toEqual({ connector: "nivo", tool: "tool.payment.credit.list" })
        expect(subject.addressOf("nivo.tool.lead.order.list")).toEqual({
            connector: "nivo",
            tool: "tool.lead.order.list",
        })
        expect(subject.addressOf("booking")).toBeNull()
        expect(subject.addressOf("Hakuen.booking.hold")).toBeNull()
        // A CRM operation is a tool a node calls (owner chốt 2026-11-13); any other `nivo.api.*` read is not.
        expect(subject.addressOf("nivo.api.crm.nivoweb.get.customers")).toEqual({ connector: "nivo", tool: "api.crm.nivoweb.get.customers" })
        expect(subject.addressOf("nivo.api.sepay.info")).toBeNull()
        expect(subject.fullNameOf("hakuen", "stay.current")).toBe("hakuen.stay.current")
    })

    it("prefers the exact grant over the connector wildcard", async () => {
        const subject = await build()
        const grants = [grant("hakuen.*", "auto"), grant("hakuen.keycode.reveal", "ask")]
        expect(subject.grantFor(grants, "hakuen.keycode.reveal")?.mode).toBe("ask")
        expect(subject.grantFor(grants, "hakuen.rates.quote")?.mode).toBe("auto")
        expect(subject.grantFor(grants, "nivo.tool.payment.credit.list")).toBeNull()
        expect(subject.grantFor(grants, "bad")).toBeNull()
    })

    it("finds a spec by its local name", async () => {
        const subject = await build()
        expect(subject.specOf(MANIFEST, "spa.hold")?.scope).toBe("write")
        expect(subject.specOf(MANIFEST, "spa.nope")).toBeNull()
    })

})

describe("tool-name.policy: full names through an index, not by the first dot", () => {
    const nivoContext: ToolManifest = {
        key: "nivo-context",
        namespace: "nivo.tool",
        name: "NIVO",
        contractVersion: "nivo-native@1",
        tools: [toolSpec("lead.order.list", "Orders."), toolSpec("conversation.message.list", "Thread.")],
    }
    const nivoBrain: ToolManifest = {
        ...nivoContext,
        key: "brain",
        namespace: "nivo.tool.brain",
        tools: [toolSpec("change.propose", "Propose.", "write")],
    }
    const ledger: ToolManifest = {
        key: "ledger",
        namespace: "nivo.tool.ledger",
        name: "Ledger",
        contractVersion: "ledger@1",
        tools: [toolSpec("entry.append", "Append.", "write")],
    }
    const remote: ToolManifest = {
        key: "hakuen",
        name: "Hakuen",
        contractVersion: "hakuen@1",
        tools: [toolSpec("stay.current", "Stay.")],
    }
    const entries = [nivoContext, nivoBrain, ledger].map((manifest) => ({ manifest }))

    it("names a tool by its connector's public prefix, the key when it has none", () => {
        expect(toolNameOf(nivoContext, "lead.order.list")).toBe("nivo.tool.lead.order.list")
        expect(toolNameOf(ledger, "entry.append")).toBe("nivo.tool.ledger.entry.append")
        expect(toolNameOf(remote, "stay.current")).toBe("hakuen.stay.current")
    })

    it("resolves connectors that share the `nivo` prefix, each to its own tool, and an old id to nothing", () => {
        expect(namedToolIn(entries, "nivo.tool.lead.order.list")?.connector.manifest.key).toBe("nivo-context")
        expect(namedToolIn(entries, "nivo.tool.brain.change.propose")?.connector.manifest.key).toBe("brain")
        expect(namedToolIn(entries, "nivo.tool.ledger.entry.append")?.spec.name).toBe("entry.append")
        expect(namedToolIn(entries, "nivo.tool.ledger.append")).toBeNull()
        expect(namedToolIn(entries, ["ledger", "append"].join("."))).toBeNull()
        expect(namedToolIn(entries, "nivo-context.lead.order.list")).toBeNull()
    })

    it("refuses the start when two adapters hold one full name", () => {
        const adapterOf = (manifest: ToolManifest): NativeToolFamily =>
            ({ manifest, invoke: () => Promise.resolve({}) }) as unknown as NativeToolFamily
        const twin: ToolManifest = { ...nivoContext, key: "nivo-twin", tools: [toolSpec("lead.order.list", "Again.")] }

        expect(duplicateNamesOf([nivoContext, nivoBrain, ledger])).toEqual([])
        expect(duplicateNamesOf([nivoContext, twin])).toEqual(["nivo.tool.lead.order.list"])
        expect(() => withUniqueNames([adapterOf(nivoContext), adapterOf(twin)])).toThrow()
        expect(withUniqueNames([adapterOf(nivoContext), adapterOf(ledger)])).toHaveLength(2)
    })

    it("matches a wildcard grant by the longest prefix, and never by a bare `nivo.*` or `nivo.tool.*`", () => {
        const g = (tool: string, mode: ToolGrant["mode"]): ToolGrant => ({ tool, mode, limitVnd: null, constraints: [] })
        const grants = [
            g("nivo.*", "ask"),
            g("nivo.tool.*", "ask"),
            g("nivo.tool.lead.*", "auto"),
            g("nivo.tool.lead.order.*", "ask"),
        ]

        expect(grantFor(grants, "nivo.tool.lead.order.list")?.mode).toBe("ask")
        expect(grantFor(grants, "nivo.tool.lead.care.get")?.mode).toBe("auto")
        expect(grantFor(grants, "nivo.tool.ledger.entry.append")).toBeNull()
        expect(grantFor([...grants, g("nivo.tool.lead.order.list", "auto")], "nivo.tool.lead.order.list")?.mode).toBe("auto")
        expect(grantFor([g("nivo.tool.ledger.*", "auto")], "nivo.tool.ledger.entry.append")?.mode).toBe("auto")
    })
})

describe("tool-name.policy: the tool level of NIVO's names", () => {
    it("reads a NIVO name as a tool only at the tool level, one to four segments", () => {
        expect(addressOf("nivo.tool.customer.message.send")).toEqual({ connector: "nivo", tool: "tool.customer.message.send" })
        expect(addressOf("nivo.tool.lead.care.get")).not.toBeNull()
        expect(addressOf(dotted("nivo", "lead", "message", "send"))).toBeNull()
        expect(addressOf("nivo.api.sepay.info")).toBeNull()
        expect(addressOf("nivo.trigger.lead.message.received")).toBeNull()
        expect(addressOf("nivo.tool")).toBeNull()
        expect(addressOf(dotted("nivo", "tool", "a", "b", "c", "d", "e"))).toBeNull()
        expect(addressOf("nivo.tool.Lead.send")).toBeNull()
        expect(addressOf("hakuen.spa.findSlots")).toEqual({ connector: "hakuen", tool: "spa.findSlots" })
    })

    it("knows a bare wildcard", () => {
        expect(isBareWildcard("nivo.*")).toBe(true)
        expect(isBareWildcard("nivo.tool.*")).toBe(true)
        expect(isBareWildcard("nivo.tool.ledger.*")).toBe(false)
    })
})
