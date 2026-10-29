import { Test } from "@nestjs/testing"
import { toCustomer, toLeadContact } from "./customer.mapper"
import type { CustomerFields, LeadContactRaw } from "./customer.mapper"

const SUBJECT = Symbol("customer.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toCustomer, toLeadContact } }],
    }).compile()
    return moduleRef.get<typeof import("./customer.mapper")>(SUBJECT)
}

const customerRow = (overrides: Partial<CustomerFields> = {}): CustomerFields => ({
    id: "c-1",
    name: "Nguyen Van A",
    phone: "84901234567",
    email: "a@example.com",
    birthday: "1990-10-03",
    tierKey: "gold",
    joinedAt: new Date("2025-03-04T05:06:07.000Z"),
    note: "regular",
    ...overrides,
})

const leadRow = (overrides: Partial<LeadContactRaw> = {}): LeadContactRaw => ({
    id: "l-1",
    contact_name: "Tran B",
    phone: "0901 234 567",
    email: " B@Example.COM ",
    ...overrides,
})

describe("toCustomer", () => {
    it("maps every column and writes the join date as ISO text", async () => {
        const subject = await buildSubject()
        expect(subject.toCustomer(customerRow())).toEqual({
            id: "c-1",
            name: "Nguyen Van A",
            phone: "84901234567",
            email: "a@example.com",
            birthday: "1990-10-03",
            tierKey: "gold",
            joinedAt: "2025-03-04T05:06:07.000Z",
            note: "regular",
        })
    })

    it("keeps absent optional columns as null", async () => {
        const subject = await buildSubject()
        expect(subject.toCustomer(customerRow({ phone: null, email: null, birthday: null, tierKey: null }))).toEqual({
            id: "c-1",
            name: "Nguyen Van A",
            phone: null,
            email: null,
            birthday: null,
            tierKey: null,
            joinedAt: "2025-03-04T05:06:07.000Z",
            note: "regular",
        })
    })
})

describe("toLeadContact", () => {
    it("normalises the phone and the email", async () => {
        const subject = await buildSubject()
        expect(subject.toLeadContact(leadRow())).toEqual({
            id: "l-1",
            name: "Tran B",
            phone: "84901234567",
            email: "b@example.com",
        })
    })

    it("answers null for an absent or malformed phone and email", async () => {
        const subject = await buildSubject()
        expect(subject.toLeadContact(leadRow({ phone: null, email: null }))).toEqual({
            id: "l-1",
            name: "Tran B",
            phone: null,
            email: null,
        })
        expect(subject.toLeadContact(leadRow({ phone: "12", email: "not-an-email" }))).toEqual({
            id: "l-1",
            name: "Tran B",
            phone: null,
            email: null,
        })
    })
})
