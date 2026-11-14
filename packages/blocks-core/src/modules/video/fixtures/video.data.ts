import type { StoredRecord } from "../../../rules/video/workbench"

/** The instant the samples were written at. */
const AT = "2026-11-13T08:00:00.000Z"

/** A sample record of a declared type, written at `AT`. */
const recordOf = (id: string, data: Readonly<Record<string, unknown>>): StoredRecord => ({
    id,
    version: "1",
    createdAt: AT,
    updatedAt: AT,
    data,
})

/** Two sample projects: one waiting for review with its script, one draft with none yet. */
export const SAMPLE_PROJECTS: ReadonlyArray<StoredRecord> = [
    recordOf("8d0f8c0e-5a52-4d5e-9a3e-1f2c3d4e5f60", {
        title: "\u01afu \u0111\u00e3i hoa h\u1ed3ng tu\u1ea7n n\u00e0y",
        goal: "offer",
        aspect: "9:16",
        targetSeconds: 20,
        brief: "Gi\u1ea3m 20% hoa h\u1ed3ng \u0111\u1ecf \u0111\u1ebfn Ch\u1ee7 nh\u1eadt",
        status: "review",
        script: {
            scenes: [
                { role: "hook", caption: "Hoa h\u1ed3ng gi\u1ea3m 20%", voiceover: "Tu\u1ea7n n\u00e0y hoa h\u1ed3ng \u0111\u1ecf gi\u1ea3m hai m\u01b0\u01a1i ph\u1ea7n tr\u0103m.", visual: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf" },
                { role: "body", caption: "\u0110\u1ebfn h\u1ebft Ch\u1ee7 nh\u1eadt", voiceover: "\u01afu \u0111\u00e3i \u0111\u1ebfn h\u1ebft Ch\u1ee7 nh\u1eadt.", visual: "L\u1ecbch tu\u1ea7n" },
                { role: "cta", caption: "Nh\u1eafn tin \u0111\u1eb7t ngay", voiceover: "Nh\u1eafn tin cho ti\u1ec7m \u0111\u1ec3 \u0111\u1eb7t.", visual: "\u0110i\u1ec7n tho\u1ea1i nh\u1eafn tin" },
            ],
        },
        lastError: null,
        publishedAt: null,
    }),
    recordOf("2b6a1d4e-7c3f-4e2a-8b1d-0e9f8a7b6c50", {
        title: "Gi\u1edbi thi\u1ec7u ti\u1ec7m",
        goal: "service",
        aspect: "16:9",
        targetSeconds: 30,
        brief: "",
        status: "draft",
        script: { scenes: [] },
        lastError: null,
        publishedAt: null,
    }),
]

/** One finished making of the first project: a clip per scene, the narration and the composed video. */
export const SAMPLE_RENDERS: ReadonlyArray<StoredRecord> = [
    recordOf("5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710", {
        projectId: "8d0f8c0e-5a52-4d5e-9a3e-1f2c3d4e5f60",
        state: "done",
        jobs: { ids: ["op-1", "op-2", "op-3"] },
        clips: [
            { key: "ws1/blocks-core.video.render/5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710/clips/o1", mime: "video/mp4", size: 1_200_000, name: "scene-1.mp4" },
            { key: "ws1/blocks-core.video.render/5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710/clips/o2", mime: "video/mp4", size: 1_100_000, name: "scene-2.mp4" },
            { key: "ws1/blocks-core.video.render/5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710/clips/o3", mime: "video/mp4", size: 1_300_000, name: "scene-3.mp4" },
        ],
        voice: { key: "ws1/blocks-core.video.render/5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710/voice/o4", mime: "audio/mpeg", size: 180_000, name: "narration.mp3" },
        output: { key: "ws1/blocks-core.video.render/5e4d3c2b-1a09-4f8e-9d7c-6b5a49382710/output/o5", mime: "video/mp4", size: 3_900_000, name: "video.mp4" },
        renderId: "rnd-1",
        provider: "shotstack",
        error: null,
    }),
]

/** The workspace's brand kit. */
export const SAMPLE_BRAND: StoredRecord = recordOf("9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c60", {
    shopName: "Ti\u1ec7m Hoa Mai",
    primaryColor: "#e11d48",
    secondaryColor: "#0f172a",
    voiceId: null,
})
