import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { MetaEvent } from "@modules/integrations/meta"
import {
    metaLineOf,
    FACEBOOK_MESSAGE_WEBHOOK as realFacebook,
    INSTAGRAM_MESSAGE_WEBHOOK as realInstagram,
    metaMessageTriggerOf as realTriggerOf,
} from "./meta-message.trigger"

const SUBJECT = Symbol("meta-message.trigger")
type Subject = { facebook: typeof realFacebook; instagram: typeof realInstagram; triggerOf: typeof realTriggerOf }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { facebook: realFacebook, instagram: realInstagram, triggerOf: realTriggerOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const event = (patch: Partial<MetaEvent> = {}): MetaEvent => ({
    kind: "dm",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: "psid-1",
    sender_igsid: null,
    sender_name: "Lan",
    text: "Chao shop",
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: "mid-1",
    timestamp: 1_762_217_400_123,
    event_key: "ev-1",
    ...patch,
})

const ORIGIN = { connectionId: "conn-1" }

const row = (raw: MetaEvent) => ({ eventKey: raw.event_key, raw })

describe("the Meta message triggers", () => {
    it("declares one verb per platform, received by the Meta webhook, keyed by the person on the account", async () => {
        const { facebook, instagram } = await buildSubject()

        expect([facebook.provider, facebook.verb, facebook.via, facebook.key]).toEqual([
            PROVIDER.meta,
            TRIGGER.facebookMessageReceived,
            "webhook",
            { by: "subject" },
        ])
        expect(instagram.verb).toBe(TRIGGER.instagramMessageReceived)
        expect([facebook.settle, instagram.settle]).toEqual([{ windowMs: 6000, maxWaitMs: 20_000 }, { windowMs: 6000, maxWaitMs: 20_000 }])
    })

    it("translates a Page's direct message into one event: the event key, the person by their scoped id with Meta's name, the line", async () => {
        const { facebook } = await buildSubject()

        expect(facebook.translate(row(event()), ORIGIN)).toEqual({
            id: "ev-1",
            subject: { channel: "facebook", id: "psid-1", name: "Lan" },
            data: { messageKey: "meta:ev-1", text: "Chao shop", at: new Date(1_762_217_400_123).toISOString() },
        })
    })

    it("is pure and its data fits the declared schema; each platform answers only its own events", async () => {
        const { facebook, instagram, triggerOf } = await buildSubject()
        const ig = event({ platform: "instagram", page_id: null, ig_id: "ig-1", sender_psid: null, sender_igsid: "igsid-1", sender_name: null })

        expect(facebook.translate(row(event()), ORIGIN)).toEqual(facebook.translate(row(event()), ORIGIN))
        expect(facebook.data.safeParse(facebook.translate(row(event()), ORIGIN)?.data).success).toBe(true)
        expect(facebook.raw.safeParse(row(event())).success).toBe(true)
        expect(facebook.translate(row(ig), ORIGIN)).toBeNull()
        expect(instagram.translate(row(ig), ORIGIN)?.subject).toEqual({ channel: "instagram", id: "igsid-1" })
        expect(triggerOf(row(ig))).toBe(instagram)
        expect(triggerOf(row(event()))).toBe(facebook)
    })

    it("drops comments, mentions, postbacks, lead ads and a message with no words or no person", async () => {
        const { facebook } = await buildSubject()

        const dropped = [
            event({ kind: "comment", comment_id: "c-1" }),
            event({ kind: "mention" }),
            event({ kind: "postback", postback_payload: "GET_STARTED" }),
            event({ kind: "leadgen", leadgen_id: "l-1" }),
            event({ text: null }),
            event({ text: "" }),
            event({ sender_psid: null }),
        ]

        for (const one of dropped) expect(facebook.translate(row(one), ORIGIN)).toBeNull()
    })
})

describe("FACEBOOK / INSTAGRAM message: the person's line (owner ruling R26)", () => {
    it("gives the engine the message's line: its key, its words, the channel's time", () => {
        expect(metaLineOf({ messageKey: "meta:e-1", text: "Shop còn hoa không?", at: "2026-11-14T02:00:00.000Z" })).toEqual({
            key: "meta:e-1",
            text: "Shop còn hoa không?",
            at: "2026-11-14T02:00:00.000Z",
        })
        expect(realFacebook.line).toBe(metaLineOf)
    })

    it("gives no line for the release door's resume (no key)", () => {
        expect(metaLineOf({ messageKey: "", text: "", at: null, resume: "held" })).toBeNull()
    })
})
