import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SYSTEM_PROMPT, SKIPPED_VERSION, TRUTHS_VERSION, fieldsOf, followUpOf, foreignLabel, languageOf, needsTruths, parseFacts, quoteHoldsValue, quoteOf, userPrompt, wasSkipped } from "./extraction.policy"
import type { ReadPassage } from "./extraction.policy"
import { BINH_THANH_40_000_D_VI, DAT_HOA_GIAO_TRONG_NGAY_THOI_GIAN_DAT_TRUOC_VI, GIAO_HANG_QUAN_12_TU_CHI_NHANH_2_PHI_GIAO_VI, KHACH_DAT_HOA_GIAO_TRONG_NGAY_CAN_DAT_TRUOC_VI, NHAN_VIEN_DUNG_QUAY_DUOC_GIAM_GIA_TOI_DA_5_C_VI, NOI_GIAO_TU_CHI_NHANH_2_PHI_GIAO_VI, QUAN_12_40_000_D_VI, TIEM_NGHI_TU_06_02_2027_DEN_HET_09_02_2027_VI, TIEN_HOAN_DUOC_CHUYEN_KHOAN_LAI_CHO_KHACH_TR_VI, V_1_BUSINESS_TIEM_NGAY_NGHI_2027_02_06_2027_02_VI, V_1_CHINH_SACH_GIAM_GIA_NHAN_VIEN_DUNG_QUAY_MU_VI, V_1_POLICY_GIAM_GIA_NHAN_VIEN_DUNG_QUAY_MUC_TO_VI, V_1_POLICY_GIAM_GIA_NHAN_VIEN_MUC_TOI_DA_5_202_2_VI, V_1_POLICY_GIAM_GIA_NHAN_VIEN_MUC_TOI_DA_5_202_VI, V_1_POLICY_GIAO_HANG_QUAN_12_TU_CHI_NHANH_2_PH_VI, V_3_GIO_VI, V_40_000_D_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"

const SUBJECT = Symbol("extraction.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./extraction.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<typeof import("./extraction.policy")>({ fieldsOf, followUpOf, foreignLabel, languageOf, needsTruths, parseFacts, quoteHoldsValue, quoteOf, userPrompt, wasSkipped }) }],
    }).compile()
    return moduleRef.get<typeof import("./extraction.policy")>(SUBJECT)
}

describe("extraction.policy: the evidence quote is the line the truth was read from (D-N-14)", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("prefers the line that writes the value over one that only shares its number (A01: 3 hours, not 3 working days)", () => {
        const a01 = [
            TIEN_HOAN_DUOC_CHUYEN_KHOAN_LAI_CHO_KHACH_TR_VI,
            KHACH_DAT_HOA_GIAO_TRONG_NGAY_CAN_DAT_TRUOC_VI,
        ].join("\n")
        expect(subject.quoteOf(a01, V_3_GIO_VI, DAT_HOA_GIAO_TRONG_NGAY_THOI_GIAN_DAT_TRUOC_VI)).toBe(
            KHACH_DAT_HOA_GIAO_TRONG_NGAY_CAN_DAT_TRUOC_VI,
        )
    })

    it("takes the row that names the truth's case among rows of the same value (P01: District 12, not Binh Thanh)", () => {
        const p01 = [
            NOI_GIAO_TU_CHI_NHANH_2_PHI_GIAO_VI,
            "|---|---|",
            BINH_THANH_40_000_D_VI,
            QUAN_12_40_000_D_VI,
        ].join("\n")
        expect(subject.quoteOf(p01, V_40_000_D_VI, GIAO_HANG_QUAN_12_TU_CHI_NHANH_2_PHI_GIAO_VI)).toBe(QUAN_12_40_000_D_VI)
        const [fact] = subject.parseFacts(V_1_POLICY_GIAO_HANG_QUAN_12_TU_CHI_NHANH_2_PH_VI, [
            { id: "p", hash: "h", text: p01 },
        ], "Asia/Ho_Chi_Minh").facts
        expect(fact?.quote).toBe(QUAN_12_40_000_D_VI)
    })
})

describe("extraction.policy: a skipped passage", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    const rule = { id: "c", order: 0, text: "x", hash: "h", triage: "rule" as const, triageVersion: 3 }

    it("is not read again in the same reading, and is known as skipped so the next reading reads it", () => {
        expect(subject.needsTruths({ ...rule, truthsVersion: SKIPPED_VERSION })).toBe(false)
        expect(subject.wasSkipped({ ...rule, truthsVersion: SKIPPED_VERSION })).toBe(true)
        expect(subject.needsTruths({ ...rule, truthsVersion: null })).toBe(true)
        expect(subject.needsTruths({ ...rule, truthsVersion: TRUTHS_VERSION })).toBe(false)
    })
})

describe("extraction.policy: harmless shape drift is read, a shifted column never is (D-R-4)", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    const STAFF: ReadPassage = { id: "s", hash: "hs", text: NHAN_VIEN_DUNG_QUAY_DUOC_GIAM_GIA_TOI_DA_5_C_VI }

    it("reads the stored round A line with an extra EMPTY field and a type written in Vietnamese (type: other, the line kept)", () => {
        const parsed = subject.parseFacts(V_1_CHINH_SACH_GIAM_GIA_NHAN_VIEN_DUNG_QUAY_MU_VI, [STAFF], "Asia/Ho_Chi_Minh")
        expect(parsed.facts).toHaveLength(1)
        expect(parsed.facts[0]).toMatchObject({ subjectType: "other", value: "5%", unit: null, validFrom: null, validTo: null })
        expect(parsed.refused).toEqual([])
    })

    it("reads a line whose last fields are missing, and dates by what they hold when there are too many fields", () => {
        const [short] = subject.parseFacts(V_1_POLICY_GIAM_GIA_NHAN_VIEN_MUC_TOI_DA_5_202_VI, [STAFF], "Asia/Ho_Chi_Minh").facts
        expect(short).toMatchObject({ validFrom: "2025-12-31T17:00:00.000Z", validTo: null })
        const [late] = subject.parseFacts(V_1_POLICY_GIAM_GIA_NHAN_VIEN_MUC_TOI_DA_5_202_2_VI, [STAFF], "Asia/Ho_Chi_Minh").facts
        expect(late).toMatchObject({ validFrom: null, validTo: "2026-12-31T17:00:00.000Z" })
    })

    it("refuses a line whose extra field carries a value or text: a column may have shifted", () => {
        expect(subject.parseFacts(V_1_POLICY_GIAM_GIA_NHAN_VIEN_DUNG_QUAY_MUC_TO_VI, [STAFF], "Asia/Ho_Chi_Minh")).toMatchObject({ facts: [], valid: false })
    })

    it("still refuses a closure with an empty value (the stored round A shape); the prompt asks for the state as the value", () => {
        const closed: ReadPassage = { id: "c", hash: "hc", text: TIEM_NGHI_TU_06_02_2027_DEN_HET_09_02_2027_VI }
        expect(subject.parseFacts(V_1_BUSINESS_TIEM_NGAY_NGHI_2027_02_06_2027_02_VI, [closed], "Asia/Ho_Chi_Minh").facts).toEqual([])
        expect(SYSTEM_PROMPT).toContain("value = the state in the passage's own words")
        expect(SYSTEM_PROMPT).toContain("Judging it is not your job")
    })
})

describe("extraction.policy: every line of rule material is accounted for (TRIAGE-3, D-T-5)", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    // Synthetic laundry price list: one item and its price per line.
    const LIST: ReadPassage = {
        id: "pl",
        hash: "hl",
        text: ["## Prices", "Shirt washed and ironed: 20,000 VND.", "Suit dry-cleaned: 90,000 VND.", "Prices include pick-up within the city."].join("\n"),
    }

    it("a line neither read into a truth nor listed as skipped is unaccounted, and asked about once more by name", () => {
        const parsed = subject.parseFacts("1|service|Shirt washing|price|20,000 VND|-|-|-", [LIST], "Asia/Ho_Chi_Minh")
        // The heading needs no account; the suit line gave no truth and was not skipped; nor was the last line.
        expect(parsed.unaccounted).toEqual(["1:L3", "1:L4"])
        expect(subject.followUpOf("unaccounted", null, parsed.unaccounted)).toContain("1:L3; 1:L4")
    })

    it("a skip line with a closed reason accounts for the lines it lists and is no truth line", () => {
        const parsed = subject.parseFacts(["1|service|Shirt washing|price|20,000 VND|-|-|-", "1|service|Suit dry-cleaning|price|90,000 VND|-|-|-", "1|skip|L4|explanation"].join("\n"), [LIST], "Asia/Ho_Chi_Minh")
        expect(parsed).toMatchObject({ unaccounted: [], refused: [], valid: true })
        expect(parsed.facts).toHaveLength(2)
    })

    it("asks for the price an item is sold at as a truth; only events are records", () => {
        expect(SYSTEM_PROMPT).toContain("an item-by-item price list or purchase list gives one truth per line")
        expect(SYSTEM_PROMPT).not.toContain("one product with its price")
    })
})
