import { sampleOf, wordOf } from "../../../shared/messages/catalog"
import { foldText, matchesQuery } from "./search"

const NGUYEN_HUE = sampleOf("sample25NguyenHue")
const DEN = `${wordOf("letterD")}en ${wordOf("letterDCapital")}en`

describe("foldText", () => {
    it("drops accents, case and extra spaces", () => {
        expect(foldText(`  ${NGUYEN_HUE}   `)).toBe("25 nguyen hue")
        expect(foldText(DEN)).toBe("den den")
    })
})

describe("matchesQuery", () => {
    it("matches everything when nothing is searched", () => {
        expect(matchesQuery(null, ["a"])).toBe(true)
        expect(matchesQuery("   ", [])).toBe(true)
    })

    it("finds a text typed without accents in a name with them", () => {
        expect(matchesQuery("nguyen hue", [NGUYEN_HUE])).toBe(true)
        expect(matchesQuery("HUE", [null, NGUYEN_HUE])).toBe(true)
    })

    it("finds a phone fragment and nothing else", () => {
        expect(matchesQuery("0912", ["84912", "0912000701"])).toBe(true)
        expect(matchesQuery("zzz", ["an", null])).toBe(false)
    })
})
