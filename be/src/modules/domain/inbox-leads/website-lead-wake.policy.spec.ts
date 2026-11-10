import { Test } from "@nestjs/testing"
import {
    firstContactOf,
    websiteLeadEventKeyOf,
    websiteLeadPayloadOf,
    websiteLeadWhoOf,
} from "./website-lead-wake.policy"
import type { WebsiteLeadFacts } from "./website-lead-wake.policy"

const POLICY = Symbol("./website-lead-wake.policy")
type PolicySubject = {
    firstContactOf: typeof firstContactOf
    websiteLeadEventKeyOf: typeof websiteLeadEventKeyOf
    websiteLeadPayloadOf: typeof websiteLeadPayloadOf
    websiteLeadWhoOf: typeof websiteLeadWhoOf
}

const buildSubject = async (): Promise<PolicySubject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { firstContactOf, websiteLeadEventKeyOf, websiteLeadPayloadOf, websiteLeadWhoOf },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

const FACTS: WebsiteLeadFacts = {
    leadId: "lead-1",
    inboundEventId: "ev-1",
    name: "Cam",
    phone: "84900000101",
    email: "cam@shop.test",
    request: "roses for Friday",
    source: { page: "/dat-hoa" },
}

describe("firstContactOf", () => {
    it("prefers ZNS, then SMS, for a phone when a connection carries them", async () => {
        const subject = await buildSubject()
        expect(subject.firstContactOf(FACTS, ["sms", "zns"])).toEqual({ route: "zns", via: "phone" })
        expect(subject.firstContactOf(FACTS, ["sms"])).toEqual({ route: "sms", via: "phone" })
    })

    it("falls to the owner's item for a phone when no connection carries a route", async () => {
        const subject = await buildSubject()
        expect(subject.firstContactOf(FACTS, [])).toEqual({ route: "owner_item", via: "phone" })
    })

    it("never uses ZNS or SMS without a phone, even when the workspace has them", async () => {
        const subject = await buildSubject()
        expect(subject.firstContactOf({ phone: null, email: "a@b.test" }, ["zns", "sms"])).toEqual({
            route: "owner_item",
            via: "email",
        })
        expect(subject.firstContactOf({ phone: null, email: null }, ["zns", "sms"])).toEqual({
            route: "owner_item",
            via: "none",
        })
    })
})

describe("websiteLeadPayloadOf", () => {
    it("hands over the facts of the form as a buying conversation with no chat", async () => {
        const subject = await buildSubject()
        expect(subject.websiteLeadPayloadOf(FACTS, { route: "owner_item", via: "phone" })).toEqual({
            kind: "website-lead",
            leadId: "lead-1",
            inboundEventId: "ev-1",
            contact: { name: "Cam", phone: "84900000101", email: "cam@shop.test" },
            request: "roses for Friday",
            source: { page: "/dat-hoa" },
            chat: false,
            firstContact: { route: "owner_item", via: "phone" },
        })
    })
})

describe("website lead keys", () => {
    it("keys the wake by the input, so one form is one wake", async () => {
        const subject = await buildSubject()
        expect(subject.websiteLeadEventKeyOf("ev-1")).toBe("website-lead:ev-1")
    })

    it("names the customer by name, else phone, else email, else nothing", async () => {
        const subject = await buildSubject()
        expect(subject.websiteLeadWhoOf(FACTS)).toBe("Cam")
        expect(subject.websiteLeadWhoOf({ ...FACTS, name: null })).toBe("84900000101")
        expect(subject.websiteLeadWhoOf({ ...FACTS, name: null, phone: null })).toBe("cam@shop.test")
        expect(subject.websiteLeadWhoOf({ ...FACTS, name: null, phone: null, email: null })).toBe("")
    })
})
