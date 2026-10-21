import { Test } from "@nestjs/testing"
import { draftMessages, postTextOf, readDraft } from "./marketing-draft.policy"

const NONE = { lessons: [], templates: [], sources: [] }
const GUIDANCE = {
    lessons: ["Shorter captions: keep three lines"],
    templates: ["Weekend offer: hook, offer, call to book"],
    sources: [],
}

const KIT = {
    brandName: "HAKUEN",
    colors: [],
    fonts: [],
    tone: "Warm",
    address: "xung HAKUEN",
    imagery: ["spa stones"],
    avoid: ["cheap"],
}

describe("draftMessages", () => {
    it("carries the brand kit, the language and the bounded request", () => {
        const [system, user] = draftMessages(` ${"r".repeat(2100)} `, KIT, "vi", NONE)

        expect(system?.content).toContain("Brand: HAKUEN.")
        expect(system?.content).toContain("Address: xung HAKUEN")
        expect(system?.content).toContain("Imagery: spa stones")
        expect(system?.content).toContain("Never use: cheap")
        expect(system?.content).toContain("Vietnamese")
        expect(user?.content).toHaveLength(2000)
    })

    it("leaves out empty brand lines and works without a kit", () => {
        const lean = draftMessages("x", { ...KIT, address: "", imagery: [], avoid: [] }, "en", NONE)[0]?.content ?? ""
        expect(lean).not.toContain("Address:")
        expect(lean).not.toContain("Imagery:")
        expect(lean).not.toContain("Never use:")
        expect(lean).toContain("English")
        expect(draftMessages("x", null, "en", NONE)[0]?.content).toContain("No brand kit yet")
        expect(lean).not.toContain("Learned from")
        expect(lean).not.toContain("NIVO marketing templates")
    })

    it("follows the learned lessons and the NIVO templates when the draft has them", () => {
        const system = draftMessages("x", KIT, "en", GUIDANCE)[0]?.content ?? ""

        expect(system).toContain(
            "Learned from the owner's earlier edits (follow them):\n- Shorter captions: keep three lines",
        )
        expect(system).toContain(
            "NIVO marketing templates (use their structure, never their facts):\n- Weekend offer: hook, offer, call to book",
        )
        expect(draftMessages("x", KIT, "en", { ...GUIDANCE, lessons: [] })[0]?.content).not.toContain("Learned from")
    })
})

describe("readDraft", () => {
    it("reads the draft, normalising hashtags and timing the script beats", () => {
        const draft = readDraft(
            JSON.stringify({
                title: "Mot cuoi tuan",
                caption: "Gac lai bon be.\nUu dai 20%.",
                hashtags: ["HAKUEN", "#Cham Soc", "#HAKUEN", "", 3],
                images: [{ headline: "Khoang lang", subline: "-20%" }, { headline: "" }, "x", { headline: "An yen" }],
                script: ["Nen thom", { line: "Massage" }, { line: "" }, "Logo", "extra"],
            }),
        )

        expect(draft).toEqual({
            title: "Mot cuoi tuan",
            caption: "Gac lai bon be.\nUu dai 20%.",
            hashtags: ["#HAKUEN", "#ChamSoc"],
            images: [
                { headline: "Khoang lang", subline: "-20%" },
                { headline: "An yen", subline: "" },
            ],
            script: [
                { at: "00-05s", line: "Nen thom" },
                { at: "05-10s", line: "Massage" },
                { at: "10-15s", line: "Logo" },
            ],
        })
    })

    it("takes the first caption line as title and tolerates missing lists", () => {
        const draft = readDraft(JSON.stringify({ caption: "Line one\nLine two", images: [{ headline: "H" }] }))

        expect(draft).toMatchObject({ title: "Line one", hashtags: [], script: [] })
    })

    it("answers null for broken JSON, a non-object, no caption or no image text", () => {
        expect(readDraft("{")).toBeNull()
        expect(readDraft("1")).toBeNull()
        expect(readDraft(JSON.stringify({ images: [{ headline: "H" }] }))).toBeNull()
        expect(readDraft(JSON.stringify({ caption: "C", images: "x" }))).toBeNull()
    })
})

describe("postTextOf", () => {
    const base = { title: "T", caption: "Caption", hashtags: ["#A", "#B"], images: [], script: [] }

    it("appends the hashtags after a blank line", () => {
        expect(postTextOf(base)).toBe("Caption\n\n#A #B")
    })

    it("is the caption alone without hashtags", () => {
        expect(postTextOf({ ...base, hashtags: [] })).toBe("Caption")
    })
})

const SUBJECT = Symbol("marketing-draft.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { draftMessages, postTextOf, readDraft } }],
    }).compile()
    return moduleRef.get<typeof import("./marketing-draft.policy")>(SUBJECT)
}

describe("marketing-draft policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.draftMessages).toBe(draftMessages)
    })
})
