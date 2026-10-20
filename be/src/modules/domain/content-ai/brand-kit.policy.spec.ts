import { Test } from "@nestjs/testing"
import * as subject from "./brand-kit.policy"

const { brandKitMessages, brandVoiceOf, cleanBrandKit, GUIDELINE_TEXT_MAX, hexOf, readBrandKit } = subject

describe("hexOf", () => {
    it("normalises six and three digit hex values with or without the hash", () => {
        expect(hexOf("#C2996B")).toBe("#c2996b")
        expect(hexOf(" 5a4632 ")).toBe("#5a4632")
        expect(hexOf("#fa3")).toBe("#ffaa33")
    })

    it("refuses what is not a hex color", () => {
        expect(hexOf("gold")).toBeNull()
        expect(hexOf(12)).toBeNull()
    })
})

describe("brandKitMessages", () => {
    it("asks for one JSON kit in the owner's language and bounds the guideline", () => {
        const [system, user] = brandKitMessages("x".repeat(GUIDELINE_TEXT_MAX + 10), "vi")

        expect(system?.content).toContain("Vietnamese")
        expect(user?.content).toHaveLength(GUIDELINE_TEXT_MAX)
        expect(brandKitMessages("g", "en")[0]?.content).toContain("English")
    })
})

describe("readBrandKit", () => {
    it("reads a full kit, dropping invalid and duplicate colors and empty entries", () => {
        const kit = readBrandKit(
            JSON.stringify({
                brandName: " HAKUEN ",
                colors: [
                    { name: "Gold", hex: "#C2996B" },
                    { name: "Gold again", hex: "#c2996b" },
                    "#5A4632",
                    { name: "Bad", hex: "nope" },
                    { hex: "#FBF7F1" },
                ],
                fonts: ["Cormorant Garamond", "", 5, "Montserrat"],
                tone: "Tinh te, am ap",
                address: "xung HAKUEN",
                imagery: ["spa"],
                avoid: ["gia re"],
            }),
        )

        expect(kit).toEqual({
            brandName: "HAKUEN",
            colors: [
                { name: "Gold", hex: "#c2996b" },
                { name: "#5a4632", hex: "#5a4632" },
                { name: "#fbf7f1", hex: "#fbf7f1" },
            ],
            fonts: ["Cormorant Garamond", "Montserrat"],
            tone: "Tinh te, am ap",
            address: "xung HAKUEN",
            imagery: ["spa"],
            avoid: ["gia re"],
        })
    })

    it("keeps a kit that has only a tone, with empty lists for missing fields", () => {
        expect(readBrandKit(JSON.stringify({ tone: "Warm", colors: "none" }))).toEqual({
            brandName: "",
            colors: [],
            fonts: [],
            tone: "Warm",
            address: "",
            imagery: [],
            avoid: [],
        })
    })

    it("answers null for broken JSON, a non-object and a kit without color or tone", () => {
        expect(readBrandKit("{")).toBeNull()
        expect(readBrandKit("[1]")).toBeNull()
        expect(readBrandKit("1")).toBeNull()
        expect(readBrandKit(JSON.stringify({ brandName: "X" }))).toBeNull()
    })
})

describe("cleanBrandKit and brandVoiceOf", () => {
    const kit = {
        brandName: "H",
        colors: [{ name: "Gold", hex: "#C2996B" }],
        fonts: [],
        tone: "Warm.",
        address: "We say HAKUEN.",
        imagery: [],
        avoid: [],
    }

    it("cleans an edited kit with the same rules", () => {
        expect(cleanBrandKit(kit)?.colors).toEqual([{ name: "Gold", hex: "#c2996b" }])
    })

    it("joins the tone and the address, skipping empty parts", () => {
        expect(brandVoiceOf(kit)).toBe("Warm. We say HAKUEN.")
        expect(brandVoiceOf({ ...kit, address: "" })).toBe("Warm.")
    })
})

const SUBJECT = Symbol("brand-kit.policy")
const POLICY = { brandKitMessages, brandVoiceOf, cleanBrandKit, GUIDELINE_TEXT_MAX, hexOf, readBrandKit }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: POLICY }],
    }).compile()
    return moduleRef.get<typeof import("./brand-kit.policy")>(SUBJECT)
}

describe("brand-kit policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.brandKitMessages).toBe(brandKitMessages)
    })
})
