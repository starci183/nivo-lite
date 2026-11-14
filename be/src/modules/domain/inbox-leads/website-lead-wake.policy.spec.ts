import { Test } from "@nestjs/testing"
import {
    websiteSubmissionEventKeyOf,
    websiteSubmissionPayloadOf,
    websiteSubmissionWhoOf,
} from "./website-lead-wake.policy"
import type { WebsiteSubmissionFacts } from "./website-lead-wake.policy"

const POLICY = Symbol("./website-lead-wake.policy")
type PolicySubject = {
    websiteSubmissionEventKeyOf: typeof websiteSubmissionEventKeyOf
    websiteSubmissionPayloadOf: typeof websiteSubmissionPayloadOf
    websiteSubmissionWhoOf: typeof websiteSubmissionWhoOf
}

const buildSubject = async (): Promise<PolicySubject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { websiteSubmissionEventKeyOf, websiteSubmissionPayloadOf, websiteSubmissionWhoOf },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

const FACTS: WebsiteSubmissionFacts = {
    contactId: "contact-1",
    siteId: "site-1",
    inboundEventId: "ev-1",
    visitorKey: "visitor:5f1c",
    name: "Cam",
    phone: "84900000101",
    email: "cam@shop.test",
    request: "roses for Friday",
    source: { page: "/dat-hoa" },
}

describe("websiteSubmissionPayloadOf", () => {
    it("hands over the contact the engine met, the site, the input and the submission; no agent record, no conversation", async () => {
        const subject = await buildSubject()
        const payload = subject.websiteSubmissionPayloadOf(FACTS)

        expect(payload).toEqual({
            contactId: "contact-1",
            siteId: "site-1",
            inboundEventId: "ev-1",
            request: "roses for Friday",
            contact: { name: "Cam", phone: "84900000101", email: "cam@shop.test" },
            source: { page: "/dat-hoa" },
        })
        expect(payload).not.toHaveProperty("leadId")
        expect(payload).not.toHaveProperty("conversationId")
    })
})

describe("website submission keys", () => {
    it("keys the wake by the input, so one form is one wake", async () => {
        const subject = await buildSubject()
        expect(subject.websiteSubmissionEventKeyOf("ev-1")).toBe("website-submission:ev-1")
    })

    it("names the visitor by name, else phone, else email, else nothing", async () => {
        const subject = await buildSubject()
        expect(subject.websiteSubmissionWhoOf(FACTS)).toBe("Cam")
        expect(subject.websiteSubmissionWhoOf({ ...FACTS, name: null })).toBe("84900000101")
        expect(subject.websiteSubmissionWhoOf({ ...FACTS, name: null, phone: null })).toBe("cam@shop.test")
        expect(subject.websiteSubmissionWhoOf({ ...FACTS, name: null, phone: null, email: null })).toBe("")
    })
})
