import { parsedScriptOf, scriptRoleAt } from "./scripting"

describe("scriptRoleAt", () => {
    it("opens with the hook, closes with the call to action, and carries the body between", () => {
        expect([0, 1, 2, 3].map((index) => scriptRoleAt(index, 4))).toEqual(["hook", "body", "body", "cta"])
        expect(scriptRoleAt(0, 1)).toBe("hook")
    })
})

describe("parsedScriptOf", () => {
    it("fixes the roles by position and folds the title", () => {
        expect(
            parsedScriptOf({
                title: "  \u01afu \u0111\u00e3i \n tu\u1ea7n n\u00e0y ",
                scenes: [
                    { role: "cta", caption: "M\u1ed9t", voiceover: "", visual: "" },
                    { caption: "Hai", voiceover: "", visual: "" },
                    { caption: "Ba", voiceover: "", visual: "" },
                ],
            }),
        ).toEqual({
            title: "\u01afu \u0111\u00e3i tu\u1ea7n n\u00e0y",
            scenes: [
                { role: "hook", caption: "M\u1ed9t", voiceover: "", visual: "" },
                { role: "body", caption: "Hai", voiceover: "", visual: "" },
                { role: "cta", caption: "Ba", voiceover: "", visual: "" },
            ],
        })
    })

    it("refuses an answer of fewer than two usable scenes, and reads a missing title as empty", () => {
        expect(parsedScriptOf({ title: "x", scenes: [{ caption: "M\u1ed9t" }, { caption: "" }] })).toBeNull()
        expect(parsedScriptOf({ scenes: [{ caption: "M\u1ed9t" }, { voiceover: "Hai" }] })?.title).toBe("")
    })
})
