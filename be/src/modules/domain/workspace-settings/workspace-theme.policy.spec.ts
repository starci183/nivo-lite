import { Test } from "@nestjs/testing"
import {
    validWorkspaceTheme,
    WORKSPACE_THEME_FONTS,
    WORKSPACE_THEME_MODES,
    WORKSPACE_THEME_RADII,
    WORKSPACE_THEME_WORD_MAX,
} from "./workspace-theme.policy"

const SUBJECT = Symbol("workspace-theme.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { validWorkspaceTheme } }],
    }).compile()
    return moduleRef.get<{ validWorkspaceTheme: typeof validWorkspaceTheme }>(SUBJECT)
}

const THEME = { hue: 17.59, chroma: 0.222, lightness: 0.5858, base: 0.5, font: "inter", radius: "medium" }

describe("validWorkspaceTheme", () => {
    it("admits the NIVO default and keeps the parameters only", async () => {
        const { validWorkspaceTheme } = await build()
        expect(validWorkspaceTheme({ ...THEME, accent: "#fff" })).toEqual({ ...THEME, mode: null })
    })

    it("admits the range edges and a chosen mode", async () => {
        const { validWorkspaceTheme } = await build()
        const edges = { hue: 360, chroma: 0.37, lightness: 0.95, base: 0, font: "roboto", radius: "square", mode: "dark" }
        expect(validWorkspaceTheme(edges)).toEqual(edges)
    })

    it("refuses each member out of its range or its list", async () => {
        const { validWorkspaceTheme } = await build()
        for (const bad of [
            { hue: -1 },
            { hue: 361 },
            { chroma: 0.38 },
            { lightness: 0.19 },
            { lightness: 0.96 },
            { base: 1.01 },
            { font: "comic-sans" },
            { radius: "round" },
            { mode: "sepia" },
        ]) {
            expect(validWorkspaceTheme({ ...THEME, ...bad })).toBeNull()
        }
    })

    it("refuses a number that is not finite or not a number, and a missing member", async () => {
        const { validWorkspaceTheme } = await build()
        expect(validWorkspaceTheme({ ...THEME, hue: Number.NaN })).toBeNull()
        expect(validWorkspaceTheme({ ...THEME, base: "0.5" })).toBeNull()
        expect(validWorkspaceTheme({ hue: 1 })).toBeNull()
        expect(validWorkspaceTheme(null)).toBeNull()
        expect(validWorkspaceTheme("theme")).toBeNull()
    })

    it("bounds the text members by the longest listed word, which no listed word exceeds", () => {
        const words: ReadonlyArray<string> = [...WORKSPACE_THEME_FONTS, ...WORKSPACE_THEME_RADII, ...WORKSPACE_THEME_MODES]
        expect(WORKSPACE_THEME_WORD_MAX).toBe(14)
        expect(words.every((word) => word.length <= WORKSPACE_THEME_WORD_MAX)).toBe(true)
        expect(words.some((word) => word.length === WORKSPACE_THEME_WORD_MAX)).toBe(true)
    })
})
