import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { RenewalNoticeFields, ZnsRenewalParams, ZnsRenewalSettings } from "./channels.contracts"
import { invalidZnsField, renewalTemplateData, withZnsRenewal, znsRenewalOf } from "./zns-renewal.policy"

const SUBJECT = Symbol("zns-renewal.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { invalidZnsField, renewalTemplateData, withZnsRenewal, znsRenewalOf } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./zns-renewal.policy")>(SUBJECT)
}

const paramsOf = builder<ZnsRenewalParams>({
    customerName: "customer_name",
    plan: "plan_name",
    endDate: "end_date",
    amount: "amount",
    transferContent: "transfer_content",
    invoiceNumber: "invoice_no",
})

const settingsOf = (patch: Partial<ZnsRenewalSettings> = {}): ZnsRenewalSettings => ({
    templateId: "246810",
    params: paramsOf(),
    ...patch,
})

const fieldsOf = builder<RenewalNoticeFields>({
    customerName: "Nguyen Lan",
    plan: "Goi Pro 12 thang",
    endDate: "2026-11-27",
    amount: 1_500_000,
    transferContent: "INV2026100001",
    invoiceNumber: "INV-202610-0001",
})

const STORED: Readonly<Record<string, string>> = {
    app_id: "123456",
    zns_renewal_template_id: "246810",
    zns_renewal_param_customer_name: "customer_name",
    zns_renewal_param_plan: "plan_name",
    zns_renewal_param_end_date: "end_date",
    zns_renewal_param_amount: "amount",
    zns_renewal_param_transfer_content: "transfer_content",
    zns_renewal_param_invoice_number: "invoice_no",
}

describe("zns-renewal policy", () => {
    describe("invalidZnsField", () => {
        it("accepts a numeric template id with valid parameter names, and an empty one that clears", async () => {
            const subject = await build()

            expect(subject.invalidZnsField(settingsOf())).toBeNull()
            expect(subject.invalidZnsField(settingsOf({ templateId: "", params: paramsOf({ plan: "" }) }))).toBeNull()
        })

        it("names the template id when it is not a number", async () => {
            const subject = await build()

            expect(subject.invalidZnsField(settingsOf({ templateId: "abc" }))).toBe("templateId")
        })

        it("names the first parameter whose name ZNS would not accept", async () => {
            const subject = await build()

            expect(subject.invalidZnsField(settingsOf({ params: paramsOf({ amount: "so tien" }) }))).toBe("amount")
            expect(subject.invalidZnsField(settingsOf({ params: paramsOf({ customerName: "1name" }) }))).toBe(
                "customerName",
            )
        })
    })
})

describe("zns-renewal policy", () => {
    describe("znsRenewalOf", () => {
        it("reads the stored template and parameter names", async () => {
            const subject = await build()

            expect(subject.znsRenewalOf(STORED)).toEqual(settingsOf())
        })

        it("answers empty names for parameters that were never set", async () => {
            const subject = await build()

            expect(subject.znsRenewalOf({ zns_renewal_template_id: " 246810 " })).toEqual({
                templateId: "246810",
                params: paramsOf({
                    customerName: "",
                    plan: "",
                    endDate: "",
                    amount: "",
                    transferContent: "",
                    invoiceNumber: "",
                }),
            })
        })

        it("answers null when no template is configured", async () => {
            const subject = await build()

            expect(subject.znsRenewalOf({ app_id: "123456" })).toBeNull()
            expect(subject.znsRenewalOf({ zns_renewal_template_id: "  " })).toBeNull()
        })
    })
})

describe("zns-renewal policy", () => {
    describe("withZnsRenewal", () => {
        it("writes the settings next to the facts already stored", async () => {
            const subject = await build()

            expect(subject.withZnsRenewal({ app_id: "123456" }, settingsOf())).toEqual(STORED)
        })

        it("removes the keys of an empty template id and empty names", async () => {
            const subject = await build()

            expect(
                subject.withZnsRenewal(
                    STORED,
                    settingsOf({
                        templateId: "",
                        params: paramsOf({ plan: " ", amount: "", endDate: "", transferContent: "" }),
                    }),
                ),
            ).toEqual({
                app_id: "123456",
                zns_renewal_param_customer_name: "customer_name",
                zns_renewal_param_invoice_number: "invoice_no",
            })
        })
    })
})

describe("zns-renewal policy", () => {
    describe("renewalTemplateData", () => {
        it("fills every named parameter, the date as dd/MM/yyyy and the amount in whole dong", async () => {
            const subject = await build()

            expect(subject.renewalTemplateData(paramsOf(), fieldsOf({ amount: 1_499_999.6 }))).toEqual({
                customer_name: "Nguyen Lan",
                plan_name: "Goi Pro 12 thang",
                end_date: "27/11/2026",
                amount: "1500000",
                transfer_content: "INV2026100001",
                invoice_no: "INV-202610-0001",
            })
        })

        it("leaves out a field without a parameter name and passes a date that is not ISO as it is", async () => {
            const subject = await build()

            expect(
                subject.renewalTemplateData(
                    paramsOf({ plan: "", transferContent: "", invoiceNumber: "", customerName: "" }),
                    fieldsOf({ endDate: "end of November" }),
                ),
            ).toEqual({ end_date: "end of November", amount: "1500000" })
        })
    })
})
