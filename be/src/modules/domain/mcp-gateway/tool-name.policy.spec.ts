import { HAKUEN_MANIFEST } from "./adapters/hakuen.manifest"
import type { ToolGrant } from "./mcp-gateway.contracts"
import { addressOf, fullNameOf, grantFor, searchTools, specOf } from "./tool-name.policy"

const grant = (tool: string, mode: ToolGrant["mode"], limits: Partial<ToolGrant> = {}): ToolGrant => ({
    tool,
    mode,
    limitVnd: null,
    constraints: [],
    ...limits,
})

describe("tool-name.policy", () => {
    it("splits a namespaced name and refuses anything else", () => {
        expect(addressOf("hakuen.booking.hold")).toEqual({ connector: "hakuen", tool: "booking.hold" })
        expect(addressOf("sepay.transactions.list")).toEqual({ connector: "sepay", tool: "transactions.list" })
        expect(addressOf("booking")).toBeNull()
        expect(addressOf("Hakuen.booking.hold")).toBeNull()
        expect(fullNameOf("hakuen", "stay.current")).toBe("hakuen.stay.current")
    })

    it("prefers the exact grant over the connector wildcard", () => {
        const grants = [grant("hakuen.*", "auto"), grant("hakuen.keycode.reveal", "never")]
        expect(grantFor(grants, "hakuen.keycode.reveal")?.mode).toBe("never")
        expect(grantFor(grants, "hakuen.rates.quote")?.mode).toBe("auto")
        expect(grantFor(grants, "sepay.transactions.list")).toBeNull()
        expect(grantFor(grants, "bad")).toBeNull()
    })

    it("finds a spec by its local name", () => {
        expect(specOf(HAKUEN_MANIFEST, "spa.hold")?.scope).toBe("write")
        expect(specOf(HAKUEN_MANIFEST, "spa.nope")).toBeNull()
    })

    it("searches only granted tools, best match first, bounded", () => {
        const grants = [grant("hakuen.*", "auto"), grant("hakuen.keycode.reveal", "never")]
        const found = searchTools([HAKUEN_MANIFEST], grants, "spa slots", 3)
        expect(found[0]?.name).toBe("hakuen.spa.findSlots")
        expect(found.length).toBeLessThanOrEqual(3)
        expect(searchTools([HAKUEN_MANIFEST], grants, "key code", 10).map((tool) => tool.name)).not.toContain(
            "hakuen.keycode.reveal",
        )
        expect(searchTools([HAKUEN_MANIFEST], grants, "", 50)).toHaveLength(10)
        expect(searchTools([HAKUEN_MANIFEST], grants, "zzz", 0)).toEqual([])
        expect(searchTools([HAKUEN_MANIFEST], [], "", 5)).toEqual([])
    })
})
