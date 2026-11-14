import { EMPTY_BRAND, brandViewOf, projectViewOf, renderFilesViewOf, renderViewOf } from "./workbench"

const AT = "2026-11-13T08:00:00.000Z"
const CLIP = { key: "ws/blocks-core.video.render/r1/clips/o1", mime: "video/mp4", size: 4096, name: "scene-1.mp4" }
const CLIP_2 = { key: "ws/blocks-core.video.render/r1/clips/o2", mime: "video/mp4", size: 2048, name: "scene-2.mp4" }
const VOICE = { key: "ws/blocks-core.video.render/r1/voice/o3", mime: "audio/mpeg", size: 100, name: "narration.mp3" }
const OUTPUT = { key: "ws/blocks-core.video.render/r1/output/o4", mime: "video/mp4", size: 900_000, name: "video.mp4" }
const recordOf = (data: Readonly<Record<string, unknown>>) => ({ id: "r1", version: "2", createdAt: AT, updatedAt: AT, data })

describe("projectViewOf", () => {
    it("reads a project and its script", () => {
        expect(
            projectViewOf(
                recordOf({
                    title: "\u01afu \u0111\u00e3i",
                    goal: "offer",
                    aspect: "16:9",
                    targetSeconds: 20,
                    brief: "Gi\u1ea3m gi\u00e1",
                    status: "review",
                    script: { scenes: [{ role: "hook", caption: "M\u1ed9t", voiceover: "", visual: "" }] },
                    lastError: null,
                    publishedAt: null,
                }),
            ),
        ).toEqual({
            id: "r1",
            version: "2",
            title: "\u01afu \u0111\u00e3i",
            goal: "offer",
            aspect: "16:9",
            targetSeconds: 20,
            brief: "Gi\u1ea3m gi\u00e1",
            status: "review",
            scenes: [{ role: "hook", caption: "M\u1ed9t", voiceover: "", visual: "" }],
            sceneCount: 1,
            lastError: null,
            publishedAt: null,
            updatedAt: AT,
        })
    })

    it("reads values it does not trust leniently", () => {
        const view = projectViewOf(recordOf({ goal: 3, aspect: "4:3", targetSeconds: "x", script: "none" }))
        expect(view).toMatchObject({
            title: "",
            goal: "custom",
            aspect: "9:16",
            targetSeconds: 30,
            status: "draft",
            sceneCount: 0,
        })
    })
})

describe("renderViewOf and brandViewOf", () => {
    it("shows how many clips a render keeps and whether its narration is kept", () => {
        expect(renderViewOf(recordOf({ state: "done", clips: [CLIP, CLIP_2], voice: null, error: null }))).toEqual({
            id: "r1",
            state: "done",
            clipCount: 2,
            hasVoice: false,
            error: null,
            createdAt: AT,
        })
        expect(renderViewOf(recordOf({ state: "generating", clips: "none", voice: VOICE }))).toMatchObject({ clipCount: 0, hasVoice: true })
    })

    it("shows the empty kit before one is saved and normalises the colours of a saved one", () => {
        expect(brandViewOf(null)).toBe(EMPTY_BRAND)
        expect(
            brandViewOf(
                recordOf({ shopName: "Mai", primaryColor: "#E11", secondaryColor: "navy", voiceId: "v1" }),
            ),
        ).toEqual({
            id: "r1",
            shopName: "Mai",
            primaryColor: "#ee1111",
            secondaryColor: null,
            voiceId: "v1",
        })
    })
})

describe("renderFilesViewOf", () => {
    it("shows the composed video, the clips in order and the narration a render holds, leaving out what is no reference", () => {
        expect(renderFilesViewOf(recordOf({ output: OUTPUT, clips: [CLIP, { key: "k" }, CLIP_2], voice: VOICE }))).toEqual({
            id: "r1",
            output: OUTPUT,
            clips: [CLIP, CLIP_2],
            voice: VOICE,
        })
        expect(renderFilesViewOf(recordOf({ output: "video.mp4", clips: "none", voice: "narration.mp3" }))).toEqual({
            id: "r1",
            output: null,
            clips: [],
            voice: null,
        })
        expect(renderFilesViewOf(recordOf({}))).toEqual({ id: "r1", output: null, clips: [], voice: null })
    })
})
