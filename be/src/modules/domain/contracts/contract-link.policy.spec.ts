import { Test } from "@nestjs/testing"
import {
    customerRecordOf,
    indexCustomers,
    linkedCustomersOf,
    matchCustomer,
    nameKeyOf,
    planLink,
} from "./contract-link.policy"
import type { CustomerRecord, CustomerRecordRead, LinkLead } from "./contract-link.policy"

const SUBJECT = Symbol("contract-link.policy")

const subjectOf = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { customerRecordOf, indexCustomers, linkedCustomersOf, matchCustomer, nameKeyOf, planLink },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./contract-link.policy")>(SUBJECT)
}

const rowOf = (data: Record<string, unknown>, extra: Partial<CustomerRecordRead> = {}): CustomerRecordRead => ({
    externalId: "EXT-1",
    title: "",
    data,
    source: "Kh\u00e1ch h\u00e0ng NIVO 2026",
    ...extra,
})

const CUSTOMER: CustomerRecord = {
    name: "H\u00c0 TRUNG L\u01afU",
    code: "HTL-250728",
    phone: "84786346888",
    email: "a@nv.vn",
    company: false,
    source: "Kh\u00e1ch h\u00e0ng NIVO 2026",
}

const leadOf = (lead: Partial<LinkLead>): LinkLead => ({
    id: "lead-1",
    phone: null,
    email: null,
    reachable: false,
    ...lead,
})

describe("nameKeyOf", () => {
    it("drops accents, case, \u0111 and punctuation", async () => {
        const policy = await subjectOf()
        expect(policy.nameKeyOf("  C\u00d4NG TY TNHH \u0110i\u1ec7n-C\u01a1  Tr\u01b0\u1eddng Ph\u00e1t ")).toBe(
            "cong ty tnhh dien co truong phat",
        )
        expect(policy.nameKeyOf("c\u00f4ng ty tnhh \u0111i\u1ec7n c\u01a1 TR\u01af\u1edcNG PH\u00c1T")).toBe(
            "cong ty tnhh dien co truong phat",
        )
    })
})

describe("customerRecordOf", () => {
    it("reads the name, the code, the first phone and the email whatever the header accents", async () => {
        const policy = await subjectOf()
        const record = policy.customerRecordOf(
            rowOf({
                "T\u00ean kh\u00e1ch h\u00e0ng": "H\u00c0 TRUNG L\u01afU",
                "M\u00e3 kh\u00e1ch h\u00e0ng": "HTL-250728",
                "S\u0110T": "0786 346 888 / 0912000701",
                Email: " A@NV.vn ",
                "Kh\u00e1ch h\u00e0ng": "C\u00e1 nh\u00e2n",
            }),
        )

        expect(record).toEqual(CUSTOMER)
    })

    it("falls back to the title and the record id and reads a company", async () => {
        const policy = await subjectOf()
        const record = policy.customerRecordOf(
            rowOf(
                { "Kh\u00e1ch h\u00e0ng": "C\u00f4ng ty", "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i": 912000701 },
                { title: "ACME", source: null },
            ),
        )

        expect(record).toEqual({
            name: "ACME",
            code: "EXT-1",
            phone: "84912000701",
            email: null,
            company: true,
            source: "",
        })
    })
})

describe("matchCustomer", () => {
    const index = indexCustomers([
        CUSTOMER,
        { ...CUSTOMER, name: "L\u00ca B\u00c1 PH\u01af\u01a0NG", code: "LP-260203", phone: null, email: null },
        { ...CUSTOMER, name: "Nguy\u1ec5n An", code: "NA-1", phone: "84900000001", email: null },
        { ...CUSTOMER, name: "Nguyen An", code: "NA-2", phone: "84900000002", email: null },
    ])

    it("matches the name without accents or case", async () => {
        const policy = await subjectOf()
        expect(policy.matchCustomer({ customerName: "ha trung luu", note: "" }, index)).toEqual({
            kind: "matched",
            customer: CUSTOMER,
        })
    })

    it("matches a customer code carried as the name or as the contract reference", async () => {
        const policy = await subjectOf()
        expect(policy.matchCustomer({ customerName: "htl-250728", note: "" }, index)).toMatchObject({ kind: "matched" })
        expect(
            policy.matchCustomer({ customerName: "Kh\u00e1ch l\u1ebb", note: "HTL-250728 \u00b7 Hosting" }, index),
        ).toMatchObject({
            kind: "matched",
            customer: CUSTOMER,
        })
    })

    it("matches a customer that only has an email, ignoring values that are neither text nor numbers", async () => {
        const policy = await subjectOf()
        const mailOnly = policy.customerRecordOf(
            rowOf({ "T\u00ean kh\u00e1ch h\u00e0ng": "Mai", Email: "mai@nv.vn", "S\u0110T": null, Active: true }),
        )

        expect(mailOnly).toEqual({ ...mailOnly, name: "Mai", phone: null, email: "mai@nv.vn" })
        expect(policy.matchCustomer({ customerName: "mai", note: "" }, policy.indexCustomers([mailOnly]))).toEqual({
            kind: "matched",
            customer: mailOnly,
        })
    })

    it("matches the name without the part in brackets", async () => {
        const policy = await subjectOf()
        expect(
            policy.matchCustomer({ customerName: "H\u00e0 Trung L\u01b0u (CRM: K\u1ebf to\u00e1n)", note: "" }, index),
        ).toMatchObject({
            kind: "matched",
        })
    })

    it("reports a customer it cannot find, one without a contact and one it cannot choose", async () => {
        const policy = await subjectOf()
        expect(
            policy.matchCustomer({ customerName: "Ch\u01b0a x\u00e1c \u0111\u1ecbnh kh\u00e1ch", note: "" }, index),
        ).toEqual({
            kind: "unmatched",
            reason: "noCustomer",
        })
        expect(policy.matchCustomer({ customerName: "L\u00ea B\u00e1 Ph\u01b0\u01a1ng", note: "" }, index)).toEqual({
            kind: "unmatched",
            reason: "noContact",
        })
        expect(policy.matchCustomer({ customerName: "NGUY\u1ec4N AN", note: "" }, index)).toEqual({
            kind: "unmatched",
            reason: "ambiguous",
        })
    })
})

describe("planLink", () => {
    it("creates a lead only when no lead holds the contact and the contract has none", async () => {
        const policy = await subjectOf()
        expect(policy.planLink(null, [], CUSTOMER)).toEqual({ kind: "create" })
    })

    it("attaches a contract without a lead to the lead that holds the phone, a conversation first", async () => {
        const policy = await subjectOf()
        const plain = leadOf({ id: "plain", phone: CUSTOMER.phone })
        const chatting = leadOf({ id: "chat", phone: CUSTOMER.phone, reachable: true })

        expect(policy.planLink(null, [plain], CUSTOMER)).toEqual({ kind: "move", leadId: "plain" })
        expect(policy.planLink(null, [plain, chatting], CUSTOMER)).toEqual({ kind: "move", leadId: "chat" })
    })

    it("fills the contract's own lead without a contact when nobody holds it", async () => {
        const policy = await subjectOf()
        expect(policy.planLink(leadOf({ id: "own" }), [], CUSTOMER)).toEqual({ kind: "fill", leadId: "own" })
    })

    it("moves a contract off its own lead without a contact to the lead that holds the phone, never duplicating it", async () => {
        const policy = await subjectOf()
        const holder = leadOf({ id: "holder", phone: CUSTOMER.phone })

        expect(policy.planLink(leadOf({ id: "own" }), [holder], CUSTOMER)).toEqual({ kind: "move", leadId: "holder" })
    })

    it("keeps a lead that already holds the contact, unless a conversation reaches another holder", async () => {
        const policy = await subjectOf()
        const own = leadOf({ id: "own", phone: CUSTOMER.phone, email: CUSTOMER.email })
        const chatting = leadOf({ id: "chat", phone: CUSTOMER.phone, reachable: true })

        expect(policy.planLink(own, [own], CUSTOMER)).toEqual({ kind: "keep" })
        expect(policy.planLink(own, [own, chatting], CUSTOMER)).toEqual({ kind: "move", leadId: "chat" })
        expect(policy.planLink({ ...own, reachable: true }, [own, chatting], CUSTOMER)).toEqual({ kind: "keep" })
    })

    it("fills the missing email of a lead that holds the phone", async () => {
        const policy = await subjectOf()
        const own = leadOf({ id: "own", phone: CUSTOMER.phone })

        expect(policy.planLink(own, [own], CUSTOMER)).toEqual({ kind: "fill", leadId: "own" })
    })

    it("keeps a lead somebody linked on purpose to another contact", async () => {
        const policy = await subjectOf()
        const own = leadOf({ id: "own", phone: "84999999999" })

        expect(policy.planLink(own, [leadOf({ id: "holder", phone: CUSTOMER.phone })], CUSTOMER)).toEqual({
            kind: "keep",
        })
    })
})

describe("linkedCustomersOf", () => {
    it("counts created leads as linked contracts and lists the unmatched ones", async () => {
        const policy = await subjectOf()
        const unmatched = { contractId: "c-3", customerName: "X", reason: "noCustomer" as const }

        expect(
            policy.linkedCustomersOf([
                { kind: "linked" },
                { kind: "created" },
                { kind: "kept" },
                { kind: "unmatched", contract: unmatched },
            ]),
        ).toEqual({ linked: 2, created: 1, unmatched: [unmatched] })
    })
})
