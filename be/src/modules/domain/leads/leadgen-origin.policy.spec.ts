import { Test } from "@nestjs/testing"
import { clip, firstText, leadOriginOf, platformOf, scoreFromFields, text } from "./leadgen-origin.policy"

const SUBJECT = Symbol("leadgen-origin.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    text,
                    firstText,
                    clip,
                    platformOf,
                    scoreFromFields,
                    leadOriginOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./leadgen-origin.policy")>(SUBJECT)
}

describe("text", () => {
    it.each([
        { value: "  Lan \n", expected: "Lan" },
        { value: 0, expected: "0" },
        { value: 12.5, expected: "12.5" },
        { value: null, expected: "" },
        { value: undefined, expected: "" },
        { value: true, expected: "" },
        { value: {}, expected: "" },
    ])("reads $value as '$expected'", async ({ value, expected }) => {
        const subject = await buildSubject()

        expect(subject.text(value)).toBe(expected)
    })
})

describe("firstText", () => {
    it("skips absent, unsupported and blank values in key order", async () => {
        const subject = await buildSubject()

        expect(
            subject.firstText({ ignored: {}, blank: "  ", number: 0, later: "later" }, [
                "missing",
                "ignored",
                "blank",
                "number",
                "later",
            ]),
        ).toBe("0")
    })

    it("returns blank when no requested field has text", async () => {
        const subject = await buildSubject()

        expect(subject.firstText({ name: "Lan" }, [])).toBe("")
        expect(subject.firstText({ empty: null, blank: "\n " }, ["empty", "blank", "missing"])).toBe("")
    })
})

describe("clip", () => {
    it("collapses whitespace and retains text within the default limit", async () => {
        const subject = await buildSubject()

        expect(subject.clip("  Hello\n\t Lan   ")).toBe("Hello Lan")
        expect(subject.clip("x".repeat(140))).toBe("x".repeat(140))
    })

    it("reserves one character for the ellipsis and trims a clipped trailing space", async () => {
        const subject = await buildSubject()

        expect(subject.clip("x".repeat(141))).toBe(`${"x".repeat(139)}…`)
        expect(subject.clip("abc def", 5)).toBe("abc…")
    })
})

describe("platformOf", () => {
    it.each([
        { hints: ["INSTAGRAM", "Facebook"], expected: "instagram" },
        { hints: ["page", "IG inbox"], expected: "instagram" },
        { hints: ["Facebook comments"], expected: "facebook" },
        { hints: ["Messenger"], expected: "facebook" },
        { hints: ["Meta lead form"], expected: "facebook" },
        { hints: ["big audience"], expected: "other" },
        { hints: [], expected: "other" },
    ])("infers $expected from $hints", async ({ hints, expected }) => {
        const subject = await buildSubject()

        expect(subject.platformOf(...hints)).toBe(expected)
    })
})

describe("scoreFromFields", () => {
    it.each([
        { fields: { score: "HOT" }, expected: "hot" },
        { fields: { lead_score: " N\u00f3ng " }, expected: "hot" },
        { fields: { temperature: "warm" }, expected: "warm" },
        { fields: { rating: "\u1ea4m" }, expected: "warm" },
        { fields: { grade: "cold" }, expected: "cold" },
        { fields: { score: "L\u1ea1nh" }, expected: "cold" },
        { fields: { score: "unknown", lead_score: "", temperature: "warm", rating: "hot" }, expected: "warm" },
        { fields: { score: 10, lead_score: null, temperature: true, grade: "unsure" }, expected: null },
        { fields: {}, expected: null },
    ])("reads $fields as $expected", async ({ fields, expected }) => {
        const subject = await buildSubject()

        expect(subject.scoreFromFields(fields)).toBe(expected)
    })
})

describe("leadOriginOf", () => {
    it("uses the first capture aliases and prioritizes ads over forms and posts", async () => {
        const subject = await buildSubject()
        expect(
            subject.leadOriginOf(
                {
                    platform: " Instagram ",
                    network: "facebook",
                    source_kind: "lead-ad",
                    source_type: "comment",
                    ad_id: " ad-1 ",
                    ad: "ad-2",
                    form_id: "form-1",
                    post_id: "post-1",
                    source_label: " Autumn campaign ",
                    post_title: "Later label",
                },
                "Inbox",
                "Other",
            ),
        ).toEqual({
            platform: "instagram",
            kind: "lead_ad",
            refKind: "ad",
            refId: "ad-1",
            refLabel: "Autumn campaign",
        })
    })
    it("uses the fallback channel and form aliases when the explicit label is empty", async () => {
        const subject = await buildSubject()
        expect(
            subject.leadOriginOf(
                {
                    network: "meta",
                    capture_kind: "leadgen",
                    leadgen_form_id: 321,
                    media_id: "post-1",
                    form_name: "Signup",
                },
                "",
                "Facebook lead form",
            ),
        ).toEqual({
            platform: "facebook",
            kind: "lead_ad",
            refKind: "form",
            refId: "321",
            refLabel: "Signup",
        })
    })
    it("attributes a comment to a post and reads an accented channel label", async () => {
        const subject = await buildSubject()
        expect(
            subject.leadOriginOf({ post: "post-1", post_name: "New menu" }, "B\u00ecnh lu\u1eadn IG", "Unknown"),
        ).toEqual({
            platform: "instagram",
            kind: "comment",
            refKind: "post",
            refId: "post-1",
            refLabel: "New menu",
        })
    })
    it.each([
        { fields: { kind: "comment" }, label: "Other", kind: "comment" },
        { fields: { reason: "mention" }, label: "Other", kind: "mention" },
        { fields: {}, label: "Nh\u1eafc", kind: "mention" },
        { fields: { source: "dm" }, label: "Other", kind: "dm" },
        { fields: {}, label: "Tin nh\u1eafn", kind: "dm" },
        { fields: {}, label: "Other", kind: "other" },
    ])("classifies $fields / $label as $kind without a reference", async ({ fields, label, kind }) => {
        const subject = await buildSubject()
        expect(subject.leadOriginOf(fields, label, "Unknown")).toEqual({
            platform: "other",
            kind,
            refKind: null,
            refId: null,
            refLabel: null,
        })
    })
})

describe("leadOriginOf", () => {
    it("prioritizes lead forms over comments and uses the available ad label", async () => {
        const subject = await buildSubject()

        expect(
            subject.leadOriginOf(
                { source_type: "form comment", ad: "ad-2", ad_name: "Lead ad" },
                "Facebook",
                "Unknown",
            ),
        ).toEqual({
            platform: "facebook",
            kind: "lead_ad",
            refKind: "ad",
            refId: "ad-2",
            refLabel: "Lead ad",
        })
    })

    it("retains a campaign label and the short form reference alias", async () => {
        const subject = await buildSubject()

        expect(subject.leadOriginOf({ form: "form-3", campaign_name: "Launch" }, "Inbox", "Meta")).toEqual({
            platform: "facebook",
            kind: "dm",
            refKind: "form",
            refId: "form-3",
            refLabel: "Launch",
        })
    })
})
