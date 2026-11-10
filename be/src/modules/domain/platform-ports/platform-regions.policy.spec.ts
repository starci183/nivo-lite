import { ABILITY_SEPARATOR, GAPS_SHOWN, abilitiesHeld, accessOf, pick, regionKey } from "./platform-regions.policy"

const READ = { id: "bank.read", label: { vi: "Đọc giao dịch", en: "Read transactions" }, scope: "read" as const }
const QR = { id: "payment.qr", label: { vi: "Tạo QR", en: "Create QR" }, scope: "write" as const }

describe("platform regions policy", () => {
    it("names the words of a region by group and value, lists five gaps and parts abilities with a middle dot", () => {
        expect(regionKey("connections", "title")).toBe("workbench.platform.connections.title")
        expect(GAPS_SHOWN).toBe(5)
        expect(ABILITY_SEPARATOR).toBe(" · ")
        expect(pick(READ.label, "vi")).toBe("Đọc giao dịch")
        expect(pick(READ.label, "en")).toBe("Read transactions")
    })

    it("keeps the abilities an attachment ticks, in the provider's order, each with its mode", () => {
        expect(abilitiesHeld([READ, QR], { "payment.qr": "ask", "bank.read": "auto", "other": "auto" })).toEqual([
            { ...READ, mode: "auto" },
            { ...QR, mode: "ask" },
        ])
        expect(abilitiesHeld([READ, QR], { "payment.qr": "off" })).toEqual([])
    })

    it("says the highest level held: auto for a write that acts alone, ask for one that waits, read, or none", () => {
        expect(accessOf([{ ...READ, mode: "auto" }, { ...QR, mode: "auto" }])).toBe("auto")
        expect(accessOf([{ ...READ, mode: "auto" }, { ...QR, mode: "ask" }])).toBe("ask")
        expect(accessOf([{ ...READ, mode: "auto" }])).toBe("read")
        expect(accessOf([])).toBeNull()
    })
})
