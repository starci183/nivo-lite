import { Test } from "@nestjs/testing"
import {
    field as realField,
    jsonOf as realJsonOf,
    messageAtOf as realMessageAtOf,
    sourceOf as realSourceOf,
    identityOf as realIdentityOf,
    channelKeyOf as realChannelKeyOf,
    keep as realKeep,
} from "./lead-flow-fields.policy"
import type { LeadSource, Platform, SourceKind } from "./lead-flows.contracts"

const anyOf = (type: unknown): unknown => expect.any(type)

const SUBJECT = Symbol("lead-flow-fields.policy")

type Subject = Pick<
    typeof import("./lead-flow-fields.policy"),
    "field" | "jsonOf" | "messageAtOf" | "sourceOf" | "identityOf" | "channelKeyOf" | "keep"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    field: realField,
                    jsonOf: realJsonOf,
                    messageAtOf: realMessageAtOf,
                    sourceOf: realSourceOf,
                    identityOf: realIdentityOf,
                    channelKeyOf: realChannelKeyOf,
                    keep: realKeep,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = "2026-10-14T10:00:00.000Z"

const emptySource: LeadSource = {
    platform: "facebook",
    kind: "leadgen",
    post_id: null,
    ad_id: null,
    form_id: null,
    comment_id: null,
    leadgen_id: null,
    referral: null,
    at: NOW,
}

describe("lead flow fields policy", () => {
    it("reads trimmed text fields and defaults missing or non-text fields", async () => {
        const subject = await build()

        expect(subject.field({ name: " An " }, "name")).toBe("An")
        expect(subject.field({ count: 42 }, "count")).toBe("")
        expect(subject.field({}, "missing")).toBe("")
    })
    it("returns parsed JSON or the parsing failure", async () => {
        const subject = await build()

        expect(subject.jsonOf('{"name":"An"}')).toEqual({ value: { name: "An" }, error: null })
        expect(subject.jsonOf("null")).toEqual({ value: null, error: null })
        expect(subject.jsonOf("broken")).toEqual({ value: undefined, error: anyOf(SyntaxError) })
    })
    it("converts positive epoch milliseconds and falls back for unusable timestamps", async () => {
        const subject = await build()

        expect(subject.messageAtOf({ message_at: "1000" }, NOW)).toBe("1970-01-01T00:00:01.000Z")
        expect(subject.messageAtOf({ message_at: 2000 }, NOW)).toBe("1970-01-01T00:00:02.000Z")
        expect(subject.messageAtOf({}, NOW)).toBe(NOW)
        expect(subject.messageAtOf({ message_at: 0 }, NOW)).toBe(NOW)
        expect(subject.messageAtOf({ message_at: -1 }, NOW)).toBe(NOW)
        expect(subject.messageAtOf({ message_at: "NaN" }, NOW)).toBe(NOW)
    })
    it("defaults an empty source and recognizes Instagram from a platform or channel label", async () => {
        const subject = await build()

        expect(subject.sourceOf({}, NOW)).toEqual(emptySource)
        expect(subject.sourceOf({ platform: "instagram", source_kind: "dm" }, NOW)).toEqual({
            ...emptySource,
            platform: "instagram",
            kind: "dm",
        })
        expect(subject.sourceOf({ platform: "facebook", channel_label: "Instagram inbox" }, NOW)).toEqual({
            ...emptySource,
            platform: "instagram",
        })
    })
})

describe("lead flow fields policy", () => {
    it("reads source identifiers, timestamp and a referral from proposal fields", async () => {
        const subject = await build()

        expect(
            subject.sourceOf(
                {
                    platform: "facebook",
                    source_kind: "comment",
                    post_id: " post-1 ",
                    ad_id: " ad-1 ",
                    form_id: " form-1 ",
                    comment_id: " comment-1 ",
                    leadgen_id: " submission-1 ",
                    referral: JSON.stringify({
                        ref: " campaign ",
                        source: " AD ",
                        type: " OPEN_THREAD ",
                        ad_id: " referral-ad ",
                    }),
                    message_at: "1000",
                },
                NOW,
            ),
        ).toEqual({
            platform: "facebook",
            kind: "comment",
            post_id: "post-1",
            ad_id: "ad-1",
            form_id: "form-1",
            comment_id: "comment-1",
            leadgen_id: "submission-1",
            referral: { ref: "campaign", source: "AD", type: "OPEN_THREAD", ad_id: "referral-ad" },
            at: "1970-01-01T00:00:01.000Z",
        })
        expect(subject.sourceOf({ referral: "broken", source_kind: "unknown" }, NOW)).toEqual(emptySource)
        expect(subject.sourceOf({ referral: "null" }, NOW)).toEqual(emptySource)
    })
})

describe("lead flow fields policy", () => {
    it("prefers explicit contacts and preserves scoped identity keys", async () => {
        const subject = await build()

        expect(
            subject.identityOf({
                psid: " psid-1 ",
                igsid: " igsid-1 ",
                phone: "0901234567",
                email: "AN@EXAMPLE.TEST",
                contact: "0987654321 other@example.test",
            }),
        ).toEqual({ psid: "psid-1", igsid: "igsid-1", phone: "84901234567", email: "an@example.test" })
    })
    it("falls back to contacts found in free text, then to a bare phone", async () => {
        const subject = await build()

        expect(subject.identityOf({ contact: "Call 0901234567 or AN@EXAMPLE.TEST" })).toEqual({
            psid: null,
            igsid: null,
            phone: "84901234567",
            email: "an@example.test",
        })
        expect(subject.identityOf({ contact: "912345678" })).toEqual({
            psid: null,
            igsid: null,
            phone: "84912345678",
            email: null,
        })
        expect(subject.identityOf({})).toEqual({ psid: null, igsid: null, phone: null, email: null })
    })
    it.each<readonly [Platform, SourceKind, string]>([
        ["facebook", "leadgen", "lead-ads"],
        ["instagram", "leadgen", "lead-ads"],
        ["instagram", "dm", "instagram-dm"],
        ["instagram", "comment", "instagram-comment"],
        ["instagram", "mention", "instagram-mention"],
        ["facebook", "dm", "facebook-dm"],
        ["facebook", "comment", "facebook-comment"],
        ["facebook", "mention", "facebook-comment"],
    ])("labels a %s %s touch as %s", async (platform, kind, expected) => {
        const subject = await build()

        expect(subject.channelKeyOf({ ...emptySource, platform, kind })).toBe(expected)
    })
    it("keeps selected values, including zero, and discards null, empty and absent fields", async () => {
        const subject = await build()

        expect(
            subject.keep(
                { name: "An", count: 0, empty: "", absent: null, other: "ignored" },
                "name",
                "count",
                "empty",
                "absent",
                "missing",
            ),
        ).toEqual({ name: "An", count: 0 })
        expect(subject.keep({ name: "An" })).toEqual({})
    })
})
