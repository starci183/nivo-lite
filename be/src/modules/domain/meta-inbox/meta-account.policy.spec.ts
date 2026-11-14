import { Test } from "@nestjs/testing"
import { event } from "@tests/fixtures/builders/meta-inbox.builder"
import { distinctSurfacesOf, isMetaEvent } from "./meta-account.policy"

const SUBJECT = Symbol("meta-account.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { distinctSurfacesOf, isMetaEvent } }],
    }).compile()
    return moduleRef.get<typeof import("./meta-account.policy")>(SUBJECT)
}

describe("meta account policy", () => {
    it("reads back an event stored as JSON and refuses what is no event", async () => {
        const policy = await buildSubject()
        expect(policy.isMetaEvent(structuredClone(event()))).toBe(true)
        expect(policy.isMetaEvent(event({ referral: { ref: "r", source: null, type: null, ad_id: null } }))).toBe(true)
        expect(policy.isMetaEvent({ ...event(), kind: "story" })).toBe(false)
        expect(policy.isMetaEvent({ ...event(), platform: "x" })).toBe(false)
        expect(policy.isMetaEvent({ ...event(), text: 3 })).toBe(false)
        expect(policy.isMetaEvent({ ...event(), referral: { ref: 1 } })).toBe(false)
        expect(policy.isMetaEvent({ ...event(), timestamp: "1" })).toBe(false)
        expect(policy.isMetaEvent({ ...event(), event_key: "" })).toBe(false)
        expect(policy.isMetaEvent([event()])).toBe(false)
        expect(policy.isMetaEvent(null)).toBe(false)
    })

    it("names each surface once, in order, and skips events with none", async () => {
        const policy = await buildSubject()
        const surfaces = policy.distinctSurfacesOf([
            event(),
            event({ platform: "instagram", page_id: null, ig_id: "ig-1" }),
            event({ event_key: "dm:2" }),
            event({ page_id: null }),
        ])
        expect(surfaces).toEqual([
            { key: "page_id", id: "page-1" },
            { key: "ig_id", id: "ig-1" },
        ])
    })
})
