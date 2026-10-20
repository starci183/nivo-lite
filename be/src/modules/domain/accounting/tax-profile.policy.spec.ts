import { Test } from "@nestjs/testing"
import { suppliersOf, taxProfileOf } from "./tax-profile.policy"

const SUBJECT = Symbol("tax-profile.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { suppliersOf, taxProfileOf } }],
    }).compile()
    return moduleRef.get<typeof import("./tax-profile.policy")>(SUBJECT)
}

const fact = (subjectKey: string, attribute: string, value: string) => ({ subjectKey, attribute, value })

describe("tax-profile.policy", () => {
    it("reads the tax profile with its defaults, and null without a tax code", async () => {
        const subject = await build()

        expect(subject.taxProfileOf([fact("tax_profile", "tax_code", " 0108896128 ")])).toEqual({
            taxCode: "0108896128",
            vatPeriod: "quarterly",
            withholdsPit: true,
            paysLicenseFee: true,
            establishedYear: 0,
            reminderDays: 7,
            supplierTermDays: 30,
        })
        expect(
            subject.taxProfileOf([
                fact("tax_profile", "tax_code", "0108896128"),
                fact("tax_profile", "vat_period", "monthly"),
                fact("tax_profile", "withholds_pit", "No"),
                fact("tax_profile", "pays_license_fee", "yes"),
                fact("tax_profile", "established_year", "2019"),
                fact("tax_profile", "reminder_days", "abc"),
                fact("tax_profile", "supplier_term_days", ""),
            ]),
        ).toEqual({
            taxCode: "0108896128",
            vatPeriod: "monthly",
            withholdsPit: false,
            paysLicenseFee: true,
            establishedYear: 2019,
            reminderDays: 7,
            supplierTermDays: 30,
        })
        expect(subject.taxProfileOf([])).toBeNull()
        expect(subject.taxProfileOf([fact("tax_profile", "tax_code", " ")])).toBeNull()
    })

    it("reads the suppliers on file and skips one without a tax code", async () => {
        const subject = await build()

        expect(
            subject.suppliersOf([
                fact("supplier:linh-an", "name", "Linh An"),
                fact("supplier:linh-an", "tax_code", "0100109106"),
                fact("supplier:linh-an", "term_days", "15"),
                fact("supplier:mai", "tax_code", "0108896128"),
                fact("supplier:empty", "tax_code", ""),
                fact("supplier:none", "name", "None"),
                fact("tax_profile", "tax_code", "x"),
            ]),
        ).toEqual([
            { name: "Linh An", taxCode: "0100109106", termDays: 15 },
            { name: "mai", taxCode: "0108896128", termDays: null },
        ])
    })
})
