import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { WEBSITE_FORM_TRIGGER as realTrigger, websiteLineOf, type WebsiteSubmissionRaw } from "./website-form.trigger"

const SUBJECT = Symbol("website-form.trigger")

const buildSubject = async (): Promise<typeof realTrigger> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: realTrigger }] }).compile()
    return moduleRef.get<typeof realTrigger>(SUBJECT)
}

const SITE = { connectionId: "site-1" }

const submission = (patch: Partial<WebsiteSubmissionRaw> = {}): WebsiteSubmissionRaw => ({
    siteId: "site-1",
    inboundEventId: "in-1",
    visitorKey: "visitor:5f1c",
    name: "Lan",
    phone: "0901234567",
    email: null,
    request: "Cho em bao gia",
    source: { page: "/hoa" },
    ...patch,
})

describe("the website form's trigger", () => {
    it("is the website verb, received by the engine's form door, keyed by the visitor's route on the site", async () => {
        const trigger = await buildSubject()

        expect([trigger.provider, trigger.verb, trigger.via, trigger.key]).toEqual([PROVIDER.nivo, TRIGGER.websiteMessageReceived, "internal", { by: "subject" }])
    })

    it("translates a submission into one event about the visitor by the site's id of them, the typed details as data (claims, never the subject)", async () => {
        const trigger = await buildSubject()

        expect(trigger.translate(submission(), SITE)).toEqual({
            id: "in-1",
            subject: { channel: "website", id: "visitor:5f1c", name: "Lan" },
            data: {
                siteId: "site-1",
                inboundEventId: "in-1",
                request: "Cho em bao gia",
                contact: { name: "Lan", phone: "0901234567", email: null },
                source: { page: "/hoa" },
            },
        })
    })

    it("is pure, fits its schemas, names nobody who gave no name, and drops a submission with no stored input or visitor", async () => {
        const trigger = await buildSubject()
        const one = submission({ name: null })

        expect(trigger.translate(one, SITE)).toEqual(trigger.translate(one, SITE))
        expect(trigger.translate(one, SITE)?.subject).toEqual({ channel: "website", id: "visitor:5f1c" })
        expect(trigger.raw.safeParse(one).success).toBe(true)
        expect(trigger.data.safeParse(trigger.translate(one, SITE)?.data).success).toBe(true)
        expect(trigger.translate(submission({ inboundEventId: "" }), SITE)).toBeNull()
        expect(trigger.translate(submission({ visitorKey: "" }), SITE)).toBeNull()
    })
})

describe("WEBSITE_FORM_TRIGGER: the visitor's line (owner ruling R26)", () => {
    const data = {
        siteId: "site-1",
        inboundEventId: "in-1",
        request: "Cho em báo giá gói thiết kế",
        contact: { name: "Lan", phone: null, email: null },
        source: {},
    }

    it("gives the request as the person's line on the site route, keyed by the stored input, said when it was received", () => {
        expect(websiteLineOf(data)).toEqual({ key: "in-1", text: "Cho em báo giá gói thiết kế", at: null })
        expect(realTrigger.line).toBe(websiteLineOf)
    })

    it("gives no line for a submission with no request", () => {
        expect(websiteLineOf({ ...data, request: null })).toBeNull()
        expect(websiteLineOf({ ...data, request: "  " })).toBeNull()
    })
})
