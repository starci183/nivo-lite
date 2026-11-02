import { Test } from "@nestjs/testing"
import { exclusionsOf, foldedOf, withoutExcluded } from "./exclusion.policy"
import type { ExclusionReason } from "./public-documents.contracts"

const SUBJECT = Symbol("exclusion.policy")
interface Subject {
    exclusionsOf: typeof exclusionsOf
    foldedOf: typeof foldedOf
    withoutExcluded: typeof withoutExcluded
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { exclusionsOf, foldedOf, withoutExcluded } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("foldedOf", () => {
    it("drops accents and case, including the stroked d", async () => {
        const subject = await buildSubject()

        const accented = [0x48, 0x1ee3, 0x70, 0x20, 0x110, 0x1ed2, 0x4e, 0x47]
            .map((code) => String.fromCodePoint(code))
            .join("")

        expect(subject.foldedOf(accented)).toBe("hop dong")
    })
})

describe("exclusionsOf", () => {
    it.each<readonly [string, string, ReadonlyArray<ExclusionReason>]>([
        ["salary", "Luong cua nhan vien la 9 trieu", ["salary"]],
        ["a payroll word", "Payroll closes on the 5th", ["salary"]],
        ["a holiday bonus", "Thuong Tet cho nhan vien", ["salary"]],
        ["an identity word", "CCCD cua nguoi dai dien", ["id_number"]],
        ["a twelve digit number", "So 079123456789 cap nam 2020", ["id_number"]],
        ["a nine digit number", "CMT 012345678", ["id_number"]],
        ["a contract", "Hop dong thue mat bang so 12", ["contract"]],
        ["charter capital", "Von dieu le 300 trieu", ["capital"]],
        ["cost price", "Gia von bo hoa hong 200.000d", ["capital"]],
        ["a dealer price", "Gia dai ly cho cua hang nho", ["internal_discount"]],
        ["a discount for dealers", "Chiet khau 15% cho dai ly", ["internal_discount"]],
        ["a staff discount in the other order", "Nhan vien duoc chiet khau 20%", ["internal_discount"]],
        ["several kinds at once", "Hop dong ghi luong va von", ["salary", "contract", "capital"]],
    ])("finds %s", async (_name, text, reasons) => {
        const subject = await buildSubject()

        expect(subject.exclusionsOf(text)).toEqual(reasons)
    })

    it.each([
        "Giao hang trong ngay cho don dat truoc 15h",
        "So luong toi da 20 bo moi don",
        "Trong luong 2 kg, khoi luong dong goi 3 kg",
        "Goi 0901234567 de dat hang",
        "Chiet khau 10% cho khach moi",
        "Mo cua 8h den 21h",
    ])("lets %s through", async (text) => {
        const subject = await buildSubject()

        expect(subject.exclusionsOf(text)).toEqual([])
    })
})

describe("withoutExcluded", () => {
    it("leaves the lines that are fine and lists the others with their reason", async () => {
        const subject = await buildSubject()
        const text = ["Opening 8 to 21", "Luong nhan vien 9 trieu", "", "", "", "Delivery within the day"].join("\n")

        expect(subject.withoutExcluded(text)).toEqual({
            kept: "Opening 8 to 21\n\nDelivery within the day",
            leftOut: [{ label: "Luong nhan vien 9 trieu", reason: "salary" }],
        })
    })

    it("masks long numbers and shortens a long label", async () => {
        const subject = await buildSubject()
        const long = `CCCD 079123456789 ${"very long ".repeat(20)}`

        const [only] = subject.withoutExcluded(long).leftOut

        expect(only?.reason).toBe("id_number")
        expect(only?.label).toContain("CCCD …")
        expect(only?.label).not.toContain("079123456789")
        expect(only?.label.endsWith("…")).toBe(true)
        expect(only?.label.length).toBeLessThanOrEqual(60)
    })

    it("keeps nothing when every line is excluded and does not list blank lines", async () => {
        const subject = await buildSubject()

        expect(subject.withoutExcluded("Hop dong A\n\nHop dong B")).toEqual({
            kept: "",
            leftOut: [
                { label: "Hop dong A", reason: "contract" },
                { label: "Hop dong B", reason: "contract" },
            ],
        })
    })
})
