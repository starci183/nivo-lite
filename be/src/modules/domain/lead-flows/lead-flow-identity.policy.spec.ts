import {
    addTouch,
    clip,
    contactIn,
    fold,
    identityPatch,
    matchFlow,
    normEmail,
    normPhone,
    sourceLine,
    textOf,
    textOrNull,
} from "./lead-flow-identity.policy"
import type { FlowIdentity } from "./lead-flow-identity.policy"
import type { Identity, LeadSource } from "./lead-flows.contracts"

const empty: Identity = { psid: null, igsid: null, phone: null, email: null }
const source: LeadSource = {
    platform: "facebook",
    kind: "dm",
    post_id: null,
    ad_id: null,
    form_id: null,
    comment_id: null,
    leadgen_id: null,
    referral: null,
    at: "2026-10-14T10:00:00.000Z",
}
const words = { kind: "message", form: "form", ad: "ad", post: "post" }

describe("lead flow identity policy", () => {
    it("trims text values and represents missing or empty text consistently", () => {
        expect(textOf(" An ")).toBe("An")
        expect(textOf(42)).toBe("")
        expect(textOrNull(" An ")).toBe("An")
        expect(textOrNull(" ")).toBeNull()
        expect(textOrNull(null)).toBeNull()
    })

    it("clips long text with an ellipsis and preserves text at the limit", () => {
        expect(clip("abc def", 5)).toBe("abc…")
        expect(clip("abcde", 5)).toBe("abcde")
        expect(fold("  \u0110\u1eb6NG   \u00c1nh \n NGUY\u1ec4N ")).toBe("dang anh nguyen")
    })

    it.each<readonly [unknown, string | null]>([
        [null, null],
        ["", null],
        ["a@example.test", null],
        ["1234567", null],
        ["090 123-4567", "84901234567"],
        ["912345678", "84912345678"],
        ["+84 901 234 567", "84901234567"],
        ["12345678", "12345678"],
        ["1234567890", "1234567890"],
    ])("normalizes phone %p as %p", (raw, expected) => {
        expect(normPhone(raw)).toBe(expected)
    })

    it("normalizes valid emails and rejects other text", () => {
        expect(normEmail(" AN@EXAMPLE.TEST ")).toBe("an@example.test")
        expect(normEmail("broken@address")).toBeNull()
        expect(normEmail(null)).toBeNull()
    })

    it("extracts the first phone and email from free text and excludes email digits", () => {
        expect(contactIn("Write AN@EXAMPLE.TEST or call +84 901 234 567; 0987654321")).toEqual({
            phone: "84901234567",
            email: "an@example.test",
        })
        expect(contactIn("0901234567@example.test")).toEqual({ phone: null, email: "0901234567@example.test" })
        expect(contactIn("No contact here")).toEqual({ phone: null, email: null })
        expect(contactIn("Call 0901234567")).toEqual({ phone: "84901234567", email: null })
    })

    it("matches the strongest identity key before a phone or email", () => {
        const phoneRow: FlowIdentity = { ...empty, phone: "84901234567", connection_id: "page-2" }
        const scopedRow: FlowIdentity = { ...empty, psid: "psid-1", connection_id: "page-1" }
        expect(matchFlow([phoneRow, scopedRow], { ...empty, psid: "psid-1", phone: "84901234567" }, "page-1")).toEqual({
            row: scopedRow,
            by: "psid",
        })
    })

    it("matches Instagram, phone and email keys and returns null when none match", () => {
        const row: FlowIdentity = {
            psid: "psid-1",
            igsid: "igsid-1",
            phone: "84901234567",
            email: "an@example.test",
            connection_id: "page-1",
        }
        expect(matchFlow([row], { ...empty, igsid: "igsid-1" }, "page-1")).toEqual({ row, by: "igsid" })
        expect(matchFlow([row], { ...empty, phone: "84901234567" }, "page-2")).toEqual({ row, by: "phone" })
        expect(matchFlow([row], { ...empty, email: "an@example.test" }, "page-2")).toEqual({ row, by: "email" })
        expect(matchFlow([row], { psid: "other", igsid: "other", phone: "other", email: "other" }, "page-1")).toBeNull()
        expect(matchFlow([row], empty, "page-1")).toBeNull()
        expect(matchFlow([], empty, null)).toBeNull()
    })

    it("rejects scoped ids from a different page and permits a missing connection on either side", () => {
        const row: FlowIdentity = { ...empty, psid: "psid-1", igsid: "igsid-1", connection_id: "page-1" }
        const identity: Identity = { ...empty, psid: "psid-1", igsid: "igsid-1" }
        expect(matchFlow([row], identity, "page-2")).toBeNull()
        expect(matchFlow([row], identity, null)).toEqual({ row, by: "psid" })
        const unbound = { ...row, connection_id: null }
        expect(matchFlow([unbound], identity, "page-2")).toEqual({ row: unbound, by: "psid" })
    })

    it("fills missing identity keys without overwriting known keys or introducing nulls", () => {
        const incoming: Identity = { psid: "p", igsid: "i", phone: "84901234567", email: "an@example.test" }
        expect(identityPatch(empty, incoming)).toEqual(incoming)
        expect(identityPatch(incoming, { psid: "other", igsid: "other", phone: "other", email: "other" })).toEqual({})
        expect(identityPatch(empty, empty)).toEqual({})
    })

    it.each<keyof Pick<LeadSource, "comment_id" | "leadgen_id" | "form_id" | "ad_id" | "post_id">>([
        "comment_id",
        "leadgen_id",
        "form_id",
        "ad_id",
        "post_id",
    ])("deduplicates touches by %s and preserves the original touch", (key) => {
        const original = { ...source, [key]: "touch-1" }
        expect(addTouch([original], { ...original, at: "2026-10-15T10:00:00.000Z" })).toEqual([original])
        expect(addTouch([original], { ...source, [key]: "touch-2" })).toEqual([
            original,
            { ...source, [key]: "touch-2" },
        ])
    })

    it("uses referral ids or an anonymous key and separates different kinds of touches", () => {
        const referral = { ...source, referral: { ref: "campaign", source: null, type: null, ad_id: null } }
        expect(addTouch([referral], referral)).toEqual([referral])
        expect(
            addTouch([source], { ...source, referral: { ref: null, source: null, type: null, ad_id: null } }),
        ).toEqual([source])
        expect(addTouch([source], { ...source, kind: "comment" })).toEqual([source, { ...source, kind: "comment" }])
    })

    it("retains only the latest thirty unique touches", () => {
        const touches = Array.from({ length: 30 }, (_, index): LeadSource => ({
            ...source,
            comment_id: `comment-${index}`,
        }))
        const latest = { ...source, comment_id: "latest" }
        expect(addTouch(touches, latest)).toEqual([...touches.slice(1), latest])
        expect(touches).toHaveLength(30)
    })

    it("formats a touch with translated labels and omits absent or empty pieces", () => {
        expect(
            sourceLine(
                {
                    ...source,
                    platform: "instagram",
                    form_id: "form-1",
                    ad_id: "ad-1",
                    post_id: "post-1",
                    referral: { ref: "campaign", source: null, type: null, ad_id: null },
                },
                words,
            ),
        ).toBe("Instagram · message · form form-1 · ad ad-1 · post post-1 · ref campaign")
        expect(sourceLine(null, words)).toBe("Facebook · message")
        expect(
            sourceLine(
                { ...source, referral: { ref: "", source: null, type: null, ad_id: null } },
                { ...words, kind: "" },
            ),
        ).toBe("Facebook")
    })
})
