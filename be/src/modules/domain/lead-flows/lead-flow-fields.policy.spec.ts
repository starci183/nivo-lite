import { channelKeyOf, field, identityOf, jsonOf, keep, messageAtOf, sourceOf } from "./lead-flow-fields.policy"
import type { LeadSource, Platform, SourceKind } from "./lead-flows.contracts"

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
    it("reads trimmed text fields and defaults missing or non-text fields", () => {
        expect(field({ name: " An " }, "name")).toBe("An")
        expect(field({ count: 42 }, "count")).toBe("")
        expect(field({}, "missing")).toBe("")
    })

    it("returns parsed JSON or the parsing failure", () => {
        expect(jsonOf('{"name":"An"}')).toEqual({ value: { name: "An" }, error: null })
        expect(jsonOf("null")).toEqual({ value: null, error: null })
        expect(jsonOf("broken")).toEqual({ value: undefined, error: expect.any(SyntaxError) })
    })

    it("converts positive epoch milliseconds and falls back for unusable timestamps", () => {
        expect(messageAtOf({ message_at: "1000" }, NOW)).toBe("1970-01-01T00:00:01.000Z")
        expect(messageAtOf({ message_at: 2000 }, NOW)).toBe("1970-01-01T00:00:02.000Z")
        expect(messageAtOf({}, NOW)).toBe(NOW)
        expect(messageAtOf({ message_at: 0 }, NOW)).toBe(NOW)
        expect(messageAtOf({ message_at: -1 }, NOW)).toBe(NOW)
        expect(messageAtOf({ message_at: "NaN" }, NOW)).toBe(NOW)
    })

    it("defaults an empty source and recognizes Instagram from a platform or channel label", () => {
        expect(sourceOf({}, NOW)).toEqual(emptySource)
        expect(sourceOf({ platform: "instagram", source_kind: "dm" }, NOW)).toEqual({
            ...emptySource,
            platform: "instagram",
            kind: "dm",
        })
        expect(sourceOf({ platform: "facebook", channel_label: "Instagram inbox" }, NOW)).toEqual({
            ...emptySource,
            platform: "instagram",
        })
    })

    it("reads source identifiers, timestamp and a referral from proposal fields", () => {
        expect(
            sourceOf(
                {
                    platform: "facebook",
                    source_kind: "comment",
                    post_id: " post-1 ",
                    ad_id: " ad-1 ",
                    form_id: " form-1 ",
                    comment_id: " comment-1 ",
                    leadgen_id: " submission-1 ",
                    referral: '{"ref":" campaign ","source":" AD ","type":" OPEN_THREAD ","ad_id":" referral-ad "}',
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
        expect(sourceOf({ referral: "broken", source_kind: "unknown" }, NOW)).toEqual(emptySource)
        expect(sourceOf({ referral: "null" }, NOW)).toEqual(emptySource)
    })

    it("prefers explicit contacts and preserves scoped identity keys", () => {
        expect(
            identityOf({
                psid: " psid-1 ",
                igsid: " igsid-1 ",
                phone: "0901234567",
                email: "AN@EXAMPLE.TEST",
                contact: "0987654321 other@example.test",
            }),
        ).toEqual({ psid: "psid-1", igsid: "igsid-1", phone: "84901234567", email: "an@example.test" })
    })

    it("falls back to contacts found in free text, then to a bare phone", () => {
        expect(identityOf({ contact: "Call 0901234567 or AN@EXAMPLE.TEST" })).toEqual({
            psid: null,
            igsid: null,
            phone: "84901234567",
            email: "an@example.test",
        })
        expect(identityOf({ contact: "912345678" })).toEqual({
            psid: null,
            igsid: null,
            phone: "84912345678",
            email: null,
        })
        expect(identityOf({})).toEqual({ psid: null, igsid: null, phone: null, email: null })
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
    ])("labels a %s %s touch as %s", (platform, kind, expected) => {
        expect(channelKeyOf({ ...emptySource, platform, kind })).toBe(expected)
    })

    it("keeps selected values, including zero, and discards null, empty and absent fields", () => {
        expect(
            keep(
                { name: "An", count: 0, empty: "", absent: null, other: "ignored" },
                "name",
                "count",
                "empty",
                "absent",
                "missing",
            ),
        ).toEqual({ name: "An", count: 0 })
        expect(keep({ name: "An" })).toEqual({})
    })
})
