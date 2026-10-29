import { builder } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { RenewalPayment } from "../automations.contracts"
import type { ContractRead, LeadRead } from "../automation-reads.contracts"
import { renewalNoticeFields as realRenewalNoticeFields } from "./renewal-notice.policy"

const SUBJECT = Symbol("renewal-notice.policy")
type Subject = { renewalNoticeFields: typeof realRenewalNoticeFields }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { renewalNoticeFields: realRenewalNoticeFields } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const contractOf = builder<ContractRead>({
    id: "c-1",
    customer_name: "Binh",
    lead_id: "l-1",
    plan: " Pro ",
    ends_on: "2026-11-30",
    amount_vnd: 990000,
    status: "active",
})
const leadOf = builder<LeadRead>({
    id: "l-1",
    contact_name: "Lan",
    company: "",
    channel: "zalo",
    need: "tea",
    stage: "new",
    phone: "0901234567",
    email: null,
})
const paymentOf = builder<RenewalPayment>({
    vars: {},
    fixedTail: undefined,
    keepExact: undefined,
    steps: [],
    invoiceNo: "INV-202611-0001",
    amountVnd: 990000,
    transferContent: "INV2026110001",
})

describe("renewalNoticeFields", () => {
    it("carries the facts the ZNS renewal template needs, as gate fields", async () => {
        const subject = await buildSubject()

        expect(subject.renewalNoticeFields(contractOf(), leadOf(), paymentOf())).toEqual({
            renewal_customer: "Lan",
            renewal_phone: "0901234567",
            renewal_plan: "Pro",
            renewal_end_date: "2026-11-30",
            renewal_amount_vnd: "990000",
            renewal_transfer_content: "INV2026110001",
            renewal_invoice: "INV-202611-0001",
        })
    })

    it("leaves the phone empty when the lead has none", async () => {
        const subject = await buildSubject()

        expect(subject.renewalNoticeFields(contractOf(), leadOf({ phone: null }), paymentOf()).renewal_phone).toBe("")
    })
})
