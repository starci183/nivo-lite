import { bankNameOf } from "./bank-name.policy"

const LISTED: ReadonlyArray<readonly [string, string]> = [
    ["VCB", "Vietcombank"],
    ["CTG", "VietinBank"],
    ["BIDV", "BIDV"],
    ["AGR", "Agribank"],
    ["MB", "MB Bank"],
    ["TCB", "Techcombank"],
    ["ACB", "ACB"],
    ["VPB", "VPBank"],
    ["STB", "Sacombank"],
    ["TPB", "TPBank"],
    ["HDB", "HDBank"],
    ["VIB", "VIB"],
    ["SHB", "SHB"],
    ["MSB", "MSB"],
    ["OCB", "OCB"],
    ["SEAB", "SeABank"],
    ["EIB", "Eximbank"],
    ["LPB", "LPBank"],
    ["NAB", "Nam A Bank"],
    ["BAB", "Bac A Bank"],
    ["ABB", "ABBank"],
    ["BVB", "BaoViet Bank"],
    ["VAB", "VietABank"],
    ["PVCB", "PVcomBank"],
    ["SCB", "SCB"],
    ["NCB", "NCB"],
    ["KLB", "KienlongBank"],
    ["CAKE", "CAKE by VPBank"],
    ["UBANK", "Ubank by VPBank"],
    ["TIMO", "Timo"],
]

describe("bankNameOf", () => {
    it.each(LISTED)("names %s as %s", (code, name) => {
        expect(bankNameOf(code)).toBe(name)
    })

    it("accepts a listed code written in lower case with surrounding spaces", () => {
        expect(bankNameOf("  vcb ")).toBe("Vietcombank")
        expect(bankNameOf("timo")).toBe("Timo")
    })

    it("keeps an unlisted code, trimmed and in upper case", () => {
        expect(bankNameOf("  xyz ")).toBe("XYZ")
        expect(bankNameOf("")).toBe("")
        expect(bankNameOf("   ")).toBe("")
    })
})
