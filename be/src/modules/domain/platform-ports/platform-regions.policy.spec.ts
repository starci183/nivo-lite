import { ABILITY_SEPARATOR, ATTACHED_ACCESS, GAPS_SHOWN, pick, regionKey } from "./platform-regions.policy"

const READ = { id: "bank.read", label: { vi: "\u0110\u1ecdc giao d\u1ecbch", en: "Read transactions" }, scope: "read" as const }

describe("platform regions policy", () => {
    it("names the words of a region by group and value, lists five gaps and parts abilities with a middle dot", () => {
        expect(regionKey("connections", "title")).toBe("workbench.platform.connections.title")
        expect(GAPS_SHOWN).toBe(5)
        expect(ABILITY_SEPARATOR).toBe(" · ")
        expect(pick(READ.label, "vi")).toBe("\u0110\u1ecdc giao d\u1ecbch")
        expect(pick(READ.label, "en")).toBe("Read transactions")
    })

    it("gives an attached account one level, whatever its provider serves: the mode of a call is its node's", () => {
        expect(ATTACHED_ACCESS).toBe("attached")
    })
})
