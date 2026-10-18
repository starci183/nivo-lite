import { Test } from "@nestjs/testing"
import {
    textOf as realTextOf,
    textOrNull as realTextOrNull,
    clip as realClip,
    fold as realFold,
    normPhone as realNormPhone,
    normEmail as realNormEmail,
    contactIn as realContactIn,
    matchFlow as realMatchFlow,
    identityPatch as realIdentityPatch,
    addTouch as realAddTouch,
    sourceLine as realSourceLine,
} from "./lead-flow-identity.policy"
import type { FlowIdentity } from "./lead-flow-identity.policy"
import type { Identity, LeadSource } from "./lead-flows.contracts"

const SUBJECT = Symbol("lead-flow-identity.policy")

type Subject = Pick<
    typeof import("./lead-flow-identity.policy"),
    | "textOf"
    | "textOrNull"
    | "clip"
    | "fold"
    | "normPhone"
    | "normEmail"
    | "contactIn"
    | "matchFlow"
    | "identityPatch"
    | "addTouch"
    | "sourceLine"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    textOf: realTextOf,
                    textOrNull: realTextOrNull,
                    clip: realClip,
                    fold: realFold,
                    normPhone: realNormPhone,
                    normEmail: realNormEmail,
                    contactIn: realContactIn,
                    matchFlow: realMatchFlow,
                    identityPatch: realIdentityPatch,
                    addTouch: realAddTouch,
                    sourceLine: realSourceLine,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    it("trims text values and represents missing or empty text consistently", async () => {
        const subject = await build()

        expect(subject.textOf(" An ")).toBe("An")
        expect(subject.textOf(42)).toBe("")
        expect(subject.textOrNull(" An ")).toBe("An")
        expect(subject.textOrNull(" ")).toBeNull()
        expect(subject.textOrNull(null)).toBeNull()
    })
    it("clips long text with an ellipsis and preserves text at the limit", async () => {
        const subject = await build()

        expect(subject.clip("abc def", 5)).toBe("abc…")
        expect(subject.clip("abcde", 5)).toBe("abcde")
        expect(subject.fold("  \u0110\u1eb6NG   \u00c1nh \n NGUY\u1ec4N ")).toBe("dang anh nguyen")
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
    ])("normalizes phone %p as %p", async (raw, expected) => {
        const subject = await build()

        expect(subject.normPhone(raw)).toBe(expected)
    })
    it("normalizes valid emails and rejects other text", async () => {
        const subject = await build()

        expect(subject.normEmail(" AN@EXAMPLE.TEST ")).toBe("an@example.test")
        expect(subject.normEmail("broken@address")).toBeNull()
        expect(subject.normEmail(null)).toBeNull()
    })
    it("extracts the first phone and email from free text and excludes email digits", async () => {
        const subject = await build()

        expect(subject.contactIn("Write AN@EXAMPLE.TEST or call +84 901 234 567; 0987654321")).toEqual({
            phone: "84901234567",
            email: "an@example.test",
        })
        expect(subject.contactIn("0901234567@example.test")).toEqual({ phone: null, email: "0901234567@example.test" })
        expect(subject.contactIn("No contact here")).toEqual({ phone: null, email: null })
        expect(subject.contactIn("Call 0901234567")).toEqual({ phone: "84901234567", email: null })
    })
})

describe("lead flow identity policy", () => {
    it("matches the strongest identity key before a phone or email", async () => {
        const subject = await build()

        const phoneRow: FlowIdentity = { ...empty, phone: "84901234567", connection_id: "page-2" }
        const scopedRow: FlowIdentity = { ...empty, psid: "psid-1", connection_id: "page-1" }
        expect(
            subject.matchFlow([phoneRow, scopedRow], { ...empty, psid: "psid-1", phone: "84901234567" }, "page-1"),
        ).toEqual({
            row: scopedRow,
            by: "psid",
        })
    })
    it("matches Instagram, phone and email keys and returns null when none match", async () => {
        const subject = await build()

        const row: FlowIdentity = {
            psid: "psid-1",
            igsid: "igsid-1",
            phone: "84901234567",
            email: "an@example.test",
            connection_id: "page-1",
        }
        expect(subject.matchFlow([row], { ...empty, igsid: "igsid-1" }, "page-1")).toEqual({ row, by: "igsid" })
        expect(subject.matchFlow([row], { ...empty, phone: "84901234567" }, "page-2")).toEqual({ row, by: "phone" })
        expect(subject.matchFlow([row], { ...empty, email: "an@example.test" }, "page-2")).toEqual({ row, by: "email" })
        expect(
            subject.matchFlow([row], { psid: "other", igsid: "other", phone: "other", email: "other" }, "page-1"),
        ).toBeNull()
        expect(subject.matchFlow([row], empty, "page-1")).toBeNull()
        expect(subject.matchFlow([], empty, null)).toBeNull()
    })
})

describe("lead flow identity policy", () => {
    it("rejects scoped ids from a different page and permits a missing connection on either side", async () => {
        const subject = await build()

        const row: FlowIdentity = { ...empty, psid: "psid-1", igsid: "igsid-1", connection_id: "page-1" }
        const identity: Identity = { ...empty, psid: "psid-1", igsid: "igsid-1" }
        expect(subject.matchFlow([row], identity, "page-2")).toBeNull()
        expect(subject.matchFlow([row], identity, null)).toEqual({ row, by: "psid" })
        const unbound = { ...row, connection_id: null }
        expect(subject.matchFlow([unbound], identity, "page-2")).toEqual({ row: unbound, by: "psid" })
    })
    it("fills missing identity keys without overwriting known keys or introducing nulls", async () => {
        const subject = await build()

        const incoming: Identity = { psid: "p", igsid: "i", phone: "84901234567", email: "an@example.test" }
        expect(subject.identityPatch(empty, incoming)).toEqual(incoming)
        expect(
            subject.identityPatch(incoming, { psid: "other", igsid: "other", phone: "other", email: "other" }),
        ).toEqual({})
        expect(subject.identityPatch(empty, empty)).toEqual({})
    })
    it.each<keyof Pick<LeadSource, "comment_id" | "leadgen_id" | "form_id" | "ad_id" | "post_id">>([
        "comment_id",
        "leadgen_id",
        "form_id",
        "ad_id",
        "post_id",
    ])("deduplicates touches by %s and preserves the original touch", async (key) => {
        const subject = await build()

        const original = { ...source, [key]: "touch-1" }
        expect(subject.addTouch([original], { ...original, at: "2026-10-15T10:00:00.000Z" })).toEqual([original])
        expect(subject.addTouch([original], { ...source, [key]: "touch-2" })).toEqual([
            original,
            { ...source, [key]: "touch-2" },
        ])
    })
    it("uses referral ids or an anonymous key and separates different kinds of touches", async () => {
        const subject = await build()

        const referral = { ...source, referral: { ref: "campaign", source: null, type: null, ad_id: null } }
        expect(subject.addTouch([referral], referral)).toEqual([referral])
        expect(
            subject.addTouch([source], { ...source, referral: { ref: null, source: null, type: null, ad_id: null } }),
        ).toEqual([source])
        expect(subject.addTouch([source], { ...source, kind: "comment" })).toEqual([
            source,
            { ...source, kind: "comment" },
        ])
    })
    it("retains only the latest thirty unique touches", async () => {
        const subject = await build()

        const touches = Array.from({ length: 30 }, (_, index): LeadSource => ({
            ...source,
            comment_id: `comment-${index}`,
        }))
        const latest = { ...source, comment_id: "latest" }
        expect(subject.addTouch(touches, latest)).toEqual([...touches.slice(1), latest])
        expect(touches).toHaveLength(30)
    })
})

describe("lead flow identity policy", () => {
    it("formats a touch with translated labels and omits absent or empty pieces", async () => {
        const subject = await build()

        expect(
            subject.sourceLine(
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
        expect(subject.sourceLine(null, words)).toBe("Facebook · message")
        expect(
            subject.sourceLine(
                { ...source, referral: { ref: "", source: null, type: null, ad_id: null } },
                { ...words, kind: "" },
            ),
        ).toBe("Facebook")
    })
})

describe("contact parser boundaries", () => {
    it("keeps first address selection across stray at signs and rejects long incomplete addresses", async () => {
        const policy = await build()
        expect(policy.contactIn("broken@local@shop.example; second@other.example")).toEqual({
            phone: null,
            email: "local@shop.example",
        })
        expect(policy.normEmail("a@b..c.")).toBe("a@b..c.")
        expect(policy.normEmail("a@b.")).toBeNull()
        expect(policy.contactIn("x".repeat(20000))).toEqual({ phone: null, email: null })
    })
})
