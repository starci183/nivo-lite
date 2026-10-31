import { Test } from "@nestjs/testing"
import {
    CHARTER_CAPITAL,
    EVENT_ATTRIBUTES,
    INVARIANTS,
    REPEALED_CITATIONS,
    ROLE_ATTRIBUTES,
    TAX_CODE,
    minimumWageOn,
} from "./pack-vocabulary.policy"

const SUBJECT = Symbol("pack-vocabulary.policy")
type Subject = { minimumWageOn: typeof minimumWageOn }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { minimumWageOn } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("the pack vocabulary", () => {
    it("names the invariants by attribute slugs, filed under their dossiers", () => {
        expect(INVARIANTS).toEqual([CHARTER_CAPITAL, TAX_CODE])
        expect(CHARTER_CAPITAL).toEqual({
            key: "charter_capital",
            attributes: ["von-dieu-le", "charter-capital"],
            filedUnder: "2",
            authority: ["1", "2"],
        })
        expect(TAX_CODE.attributes).toEqual(["ma-so-thue", "mst", "tax-code"])
        expect(EVENT_ATTRIBUTES.capital_transfer[0]).toBe("ngay-chuyen-nhuong-von")
        expect(ROLE_ATTRIBUTES.accountant.slice(0, 2)).toEqual(["nguoi-phu-trach-ke-toan", "ke-toan-truong"])
    })

    it("knows the repealed citations by folded text", () => {
        const [decree] = REPEALED_CITATIONS
        expect(decree?.pattern.test("can cu nghi dinh 123/2020 ve hoa don")).toBe(true)
        expect(decree?.pattern.test("nghi dinh 254/2026")).toBe(false)
        expect(REPEALED_CITATIONS.map((citation) => citation.key)).toEqual([
            "nd_123_2020",
            "nd_70_2025",
            "tt_132_2018",
            "pit_04_2007",
        ])
    })

    it("answers the regional minimum wage in force on a date, none before the first", async () => {
        const subject = await buildSubject()
        expect(subject.minimumWageOn("2026-03-01")).toEqual({ from: "2026-01-01", region: "III", amount: 4_140_000 })
        expect(subject.minimumWageOn("2025-12-31")).toBeNull()
    })
})
