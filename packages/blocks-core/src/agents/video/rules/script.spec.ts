import { CAPTION_MAX, SCRIPT_SCENES_MAX, clipPlanOf, readScript, scenePromptOf, voiceTextOf } from "./script"

describe("readScript", () => {
    it("cleans scenes, drops a scene with no words and an entry that is no object, and keeps the role it knows", () => {
        expect(
            readScript([
                { role: "hook", caption: "  Hoa   t\u01b0\u01a1i ", voiceover: "Ch\u00e0o", visual: "C\u1eeda ti\u1ec7m" },
                { role: "intro", caption: "", voiceover: "Giao nhanh" },
                { caption: "", voiceover: "   " },
                "not a scene",
            ]),
        ).toEqual([
            { role: "hook", caption: "Hoa t\u01b0\u01a1i", voiceover: "Ch\u00e0o", visual: "C\u1eeda ti\u1ec7m" },
            { role: "body", caption: "", voiceover: "Giao nhanh", visual: "" },
        ])
    })

    it("answers no scene for anything that is no list, and bounds the count and each text", () => {
        expect(readScript({ scenes: [] })).toEqual([])
        const many = readScript(Array.from({ length: 20 }, () => ({ caption: "x".repeat(400), voiceover: "" })))
        expect(many).toHaveLength(SCRIPT_SCENES_MAX)
        expect(many[0]?.caption).toHaveLength(CAPTION_MAX)
    })
})

const SCENES = readScript([
    { caption: "M\u1ed9t", voiceover: "L\u1eddi m\u1ed9t", visual: "C\u1ea3nh m\u1ed9t" },
    { caption: "", voiceover: "", visual: "" },
    { caption: "", voiceover: "L\u1eddi hai", visual: "" },
    { caption: "Ba", voiceover: "", visual: "" },
])

describe("the voice and the clips of a script", () => {
    it("says every voiceover in order as one text", () => {
        expect(voiceTextOf(SCENES)).toBe("L\u1eddi m\u1ed9t L\u1eddi hai")
    })

    it("plans one clip per scene", () => {
        expect(clipPlanOf(SCENES)).toEqual([4, 4, 4])
    })

    it("asks a clip for the picture, else the heading, else the voiceover", () => {
        expect(SCENES.map(scenePromptOf)).toEqual(["C\u1ea3nh m\u1ed9t", "L\u1eddi hai", "Ba"])
    })
})
