import { Test } from "@nestjs/testing"
import { parsePolicyValue, policyValueOf, writtenPolicyValue, editedPolicyValue, samePolicyValue } from "./policy-value.policy"
import { BAT_KY_CHU_NAO_VI, BA_MUOI_LAM_NGHIN_VI, CANH_VI, CHI_GIAM_KHI_MUA_NHIEU_VI, CHUYEN_KHOAN_TRUOC_100_VI, CO_VI, DON_TU_500_000_D_VI, DON_VI, KHONG_VI, MIEN_PHI_VI, MOT_DON_VI, NGAY_VI, TRONG_2_GIO_VI, TU_8H_DEN_20H_VI, T_08_00_20_00_VI, T_1_200_000_VI, T_1_2_TRIEU_VI, T_1_5_TIENG_VI, T_1_NGAY_VI, T_1_TUAN_VI, T_20_000_D_DON_VI, T_24_GIO_VI, T_2_GIO_VI, T_2_NGAY_VI, T_30_000D_VI, T_30_000_D_VI, T_30_NGAN_DONG_VI, T_30_NGHIN_VI, T_35_000_D_MOT_DON_VI, T_35_000_D_VI, T_45_PHUT_VI, T_5_PHAN_TRAM_VI, T_7_00_21_00_VI, T_7_30_DEN_21_00_VI, T_8_00_20_00_VI, T_8_00_DEN_8_00_VI, T_90_PHUT_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_FEE_VALUE_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const SUBJECT = Symbol("policy-value.policy")
type Subject = typeof import("./policy-value.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parsePolicyValue, policyValueOf, writtenPolicyValue, editedPolicyValue, samePolicyValue } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("policy values read as parameters", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it.each([
        [T_30_000_D_VI, 30000, null],
        [T_30_000D_VI, 30000, null],
        ["30k", 30000, null],
        [T_30_NGHIN_VI, 30000, null],
        [T_30_NGAN_DONG_VI, 30000, null],
        [T_1_2_TRIEU_VI, 1200000, null],
        ["350,000 VND", 350000, null],
        [T_1_200_000_VI, 1200000, null],
        [DELIVERY_FEE_VALUE_VI, 30000, MOT_DON_VI],
        [T_20_000_D_DON_VI, 20000, DON_VI],
        [MIEN_PHI_VI, 0, null],
    ])("reads %s as money", (written, amountVnd, per) => {
        expect(subject.parsePolicyValue(written)).toEqual({ type: "money", amountVnd, per })
    })

    it.each([
        ["10%", 10],
        ["12,5 %", 12.5],
        [T_5_PHAN_TRAM_VI, 5],
    ])("reads %s as percent", (written, percent) => {
        expect(subject.parsePolicyValue(written)).toEqual({ type: "percent", percent })
    })

    it.each([
        [T_24_GIO_VI, 1440],
        [T_90_PHUT_VI, 90],
        [T_2_NGAY_VI, 2880],
        [T_1_5_TIENG_VI, 90],
        [T_1_TUAN_VI, 10080],
    ])("reads %s as a duration in minutes", (written, minutes) => {
        expect(subject.parsePolicyValue(written)).toEqual({ type: "duration", minutes })
    })

    it.each([
        ["8:00-20:00", "08:00", "20:00"],
        [T_8_00_20_00_VI, "08:00", "20:00"],
        [T_7_30_DEN_21_00_VI, "07:30", "21:00"],
        [TU_8H_DEN_20H_VI, "08:00", "20:00"],
        ["22:00-02:00", "22:00", "02:00"],
    ])("reads %s as a time range", (written, from, to) => {
        expect(subject.parsePolicyValue(written)).toEqual({ type: "time_range", from, to })
    })

    it.each([
        [CO_VI, true],
        [KHONG_VI, false],
    ])("reads %s as yes or no", (written, yes) => {
        expect(subject.parsePolicyValue(written)).toEqual({ type: "boolean", yes })
    })

    it.each([DON_TU_500_000_D_VI, "30000", "10", TRONG_2_GIO_VI, "25:00-26:00", CHUYEN_KHOAN_TRUOC_100_VI, T_8_00_DEN_8_00_VI, "150%"])(
        "never guesses: %s stays text",
        (written) => {
            expect(subject.parsePolicyValue(written)).toEqual({ type: "text", text: written })
        },
    )

    it("reads the unit a fact keeps apart with its value", () => {
        expect(subject.policyValueOf("2", NGAY_VI)).toEqual({ type: "duration", minutes: 2880 })
        expect(subject.policyValueOf("12", CANH_VI)).toEqual({ type: "text", text: "12" })
    })
})

describe("policy values written, edited and compared as parameters", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("writes each parameter the way the truth graph stores it", () => {
        expect(subject.writtenPolicyValue({ type: "money", amountVnd: 35000, per: MOT_DON_VI })).toBe(T_35_000_D_MOT_DON_VI)
        expect(subject.writtenPolicyValue({ type: "money", amountVnd: 20000, per: DON_VI })).toBe(T_20_000_D_DON_VI)
        expect(subject.writtenPolicyValue({ type: "percent", percent: 12.5 })).toBe("12,5%")
        expect(subject.writtenPolicyValue({ type: "duration", minutes: 1440 })).toBe(T_1_NGAY_VI)
        expect(subject.writtenPolicyValue({ type: "duration", minutes: 120 })).toBe(T_2_GIO_VI)
        expect(subject.writtenPolicyValue({ type: "duration", minutes: 45 })).toBe(T_45_PHUT_VI)
        expect(subject.writtenPolicyValue({ type: "time_range", from: "08:00", to: "20:00" })).toBe(T_08_00_20_00_VI)
        expect(subject.writtenPolicyValue({ type: "boolean", yes: true })).toBe(CO_VI)
    })

    it("takes an edit only when it reads as the row's type; digits alone are VND, percent or minutes", () => {
        const fee = subject.parsePolicyValue(DELIVERY_FEE_VALUE_VI)
        expect(subject.editedPolicyValue(fee, "35k")).toEqual({ value: { type: "money", amountVnd: 35000, per: MOT_DON_VI } })
        expect(subject.editedPolicyValue(fee, "35000")).toEqual({ value: { type: "money", amountVnd: 35000, per: MOT_DON_VI } })
        expect(subject.editedPolicyValue(fee, BA_MUOI_LAM_NGHIN_VI)).toEqual({ problem: "not_money" })
        expect(subject.editedPolicyValue(fee, "  ")).toEqual({ problem: "empty" })
        expect(subject.editedPolicyValue(fee, "1".repeat(501))).toEqual({ problem: "too_long" })
        expect(subject.editedPolicyValue(subject.parsePolicyValue("10%"), "15")).toEqual({ value: { type: "percent", percent: 15 } })
        expect(subject.editedPolicyValue(subject.parsePolicyValue("10%"), "150")).toEqual({ problem: "not_percent" })
        expect(subject.editedPolicyValue(subject.parsePolicyValue(T_24_GIO_VI), "2880")).toEqual({ value: { type: "duration", minutes: 2880 } })
        expect(subject.editedPolicyValue(subject.parsePolicyValue("8:00-20:00"), T_7_00_21_00_VI)).toEqual({
            value: { type: "time_range", from: "07:00", to: "21:00" },
        })
        expect(subject.editedPolicyValue(subject.parsePolicyValue(CO_VI), "maybe")).toEqual({ problem: "not_boolean" })
        expect(subject.editedPolicyValue(subject.parsePolicyValue(CHI_GIAM_KHI_MUA_NHIEU_VI), BAT_KY_CHU_NAO_VI)).toEqual({
            value: { type: "text", text: BAT_KY_CHU_NAO_VI },
        })
    })

    it("compares two values as parameters", () => {
        expect(subject.samePolicyValue(subject.parsePolicyValue("30k"), subject.parsePolicyValue(T_30_000_D_VI))).toBe(true)
        expect(subject.samePolicyValue(subject.parsePolicyValue("30k"), subject.parsePolicyValue(T_35_000_D_VI))).toBe(false)
    })
})
