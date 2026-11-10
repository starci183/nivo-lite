import type * as SubjectModule from "./bank-name.policy"
import { Test } from "@nestjs/testing"
import { bankDisplayNameOf } from "./bank-name.policy"

const SUBJECT = Symbol("bank-name.policy")
type Subject = Pick<typeof SubjectModule, "bankDisplayNameOf">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bankDisplayNameOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

describe("bankDisplayNameOf", () => {
    it.each(LISTED)("names %s as %s", async (code, name) => {
        const subject = await buildSubject()

        expect(subject.bankDisplayNameOf(code)).toBe(name)
    })

    it("accepts a listed code written in lower case with surrounding spaces", async () => {
        const subject = await buildSubject()

        expect(subject.bankDisplayNameOf("  vcb ")).toBe("Vietcombank")
        expect(subject.bankDisplayNameOf("timo")).toBe("Timo")
    })

    it.each([
        ["MBBANK", "MB Bank"],
        ["MBBank", "MB Bank"],
        ["ICB", "VietinBank"],
        ["VietinBank", "VietinBank"],
        ["VBA", "Agribank"],
        ["Vietcombank", "Vietcombank"],
        ["LienVietPostBank", "LPBank"],
        ["NamABank", "Nam A Bank"],
        ["BacABank", "Bac A Bank"],
        ["BaoVietBank", "BaoViet Bank"],
        ["KienLongBank", "KienlongBank"],
        ["Nam A Bank", "Nam A Bank"],
    ])("names SePay's spelling %s as %s", async (spelling, name) => {
        const subject = await buildSubject()

        expect(subject.bankDisplayNameOf(spelling)).toBe(name)
    })

    it("keeps an unlisted code, trimmed and in upper case", async () => {
        const subject = await buildSubject()

        expect(subject.bankDisplayNameOf("  xyz ")).toBe("XYZ")
        expect(subject.bankDisplayNameOf("")).toBe("")
        expect(subject.bankDisplayNameOf("   ")).toBe("")
    })
})
