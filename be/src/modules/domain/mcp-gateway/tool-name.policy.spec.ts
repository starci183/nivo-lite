import { Test } from "@nestjs/testing"
import type { GatewayConnectorManifest, GatewayToolSpec, ToolGrant } from "./mcp-gateway.contracts"
import { addressOf, fullNameOf, grantFor, specOf, searchTools } from "./tool-name.policy"

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
