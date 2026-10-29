import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { StoredProject } from "./video-stored.contracts"
import type { WorkbenchRender } from "./video-workbench.contracts"
import {
    editorScenesOf as editorScenesOfImplementation,
    videoInputsOf as videoInputsOfImplementation,
    videoInstant as videoInstantImplementation,
    videoRecord as videoRecordImplementation,
    workbenchProjectOf as workbenchProjectOfImplementation,
    workspaceMediaPath as workspaceMediaPathImplementation,
} from "./video-workbench.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    editorScenesOf: typeof editorScenesOfImplementation
    videoInputsOf: typeof videoInputsOfImplementation
    videoInstant: typeof videoInstantImplementation
    videoRecord: typeof videoRecordImplementation
    workbenchProjectOf: typeof workbenchProjectOfImplementation
    workspaceMediaPath: typeof workspaceMediaPathImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    editorScenesOf: editorScenesOfImplementation,
                    videoInputsOf: videoInputsOfImplementation,
                    videoInstant: videoInstantImplementation,
                    videoRecord: videoRecordImplementation,
                    workbenchProjectOf: workbenchProjectOfImplementation,
                    workspaceMediaPath: workspaceMediaPathImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WS = "workspace-1"
const SOURCE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const INSTANT = "2026-10-13T09:00:00.000Z"

const rowOf = builder<StoredProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "ready",
    inputs: { source_ids: [SOURCE], notes: "  fresh bread  ", auto: true },
    script: [{ id: "hook-1", role: "hook", caption: "Fresh", media: `${WS}/a.jpg` }],
    version: 2,
    script_ms: 900,
    last_error: null,
    render_id: null,
    render_ids: ["render-0", "render-1"],
    approved_at: null,
    approved_by_name: null,
    published_at: null,
    created_at: INSTANT,
    updated_at: new Date(INSTANT),
    render: null,
})

describe("videoRecord", () => {
    it("retains an object's fields", async () => {
        const subject = await buildSubject()

        const object = { title: "Saved" }

        expect(subject.videoRecord(object)).toBe(object)
    })

    it.each([null, undefined, 5, "text", [{ title: "Saved" }]])("rejects a non-record %j", async (raw) => {
        const subject = await buildSubject()

        expect(subject.videoRecord(raw)).toEqual({})
    })
})

describe("workspaceMediaPath", () => {
    it.each([
        [`${WS}/photo.jpg`, true],
        ["other/photo.jpg", false],
        [`${WS}-other/photo.jpg`, false],
        [`${WS}/../photo.jpg`, false],
        [`${WS}/folder\\photo.jpg`, false],
        [`${WS}/photo%20one.jpg`, false],
    ] as const)("accepts workspace path %s: %s", async (path, expected) => {
        const subject = await buildSubject()

        expect(subject.workspaceMediaPath(path, WS)).toBe(expected)
    })
})

describe("videoInputsOf", () => {
    it("keeps valid UUIDs and workspace media, normalizes notes, and accepts explicit automation", async () => {
        const subject = await buildSubject()

        expect(
            subject.videoInputsOf(
                {
                    source_ids: [SOURCE, SOURCE.toUpperCase(), "not-a-uuid", 12],
                    sourceIds: ["ignored-alias"],
                    notes: "  Owner\ninstructions  ",
                    media: [12, `${WS}/one.jpg`, "other/two.jpg", `${WS}/../three.jpg`],
                    auto: true,
                },
                WS,
            ),
        ).toEqual({
            sourceIds: [SOURCE, SOURCE.toUpperCase()],
            notes: "Owner\ninstructions",
            media: [`${WS}/one.jpg`],
            auto: true,
        })
    })

    it("reads the camel-case source alias when the stored field is null", async () => {
        const subject = await buildSubject()

        expect(subject.videoInputsOf({ source_ids: null, sourceIds: [SOURCE], auto: "true" }, WS)).toEqual({
            sourceIds: [SOURCE],
            notes: "",
            media: [],
            auto: false,
        })
    })

    it.each([null, { source_ids: "wrong", notes: 5, media: {} }])("defaults malformed inputs %j", async (raw) => {
        const subject = await buildSubject()

        expect(subject.videoInputsOf(raw, WS)).toEqual({ sourceIds: [], notes: "", media: [], auto: false })
    })

    it("caps sources, instructions and media at their editor limits", async () => {
        const subject = await buildSubject()

        const sourceIds = Array.from({ length: 14 }, () => SOURCE)
        const media = Array.from({ length: 42 }, (_unused, index) => `${WS}/${index}.jpg`)

        expect(subject.videoInputsOf({ sourceIds, notes: `  ${"x".repeat(601)}  `, media }, WS)).toEqual({
            sourceIds: sourceIds.slice(0, 12),
            notes: "x".repeat(600),
            media: media.slice(0, 40),
            auto: false,
        })
    })
})

describe("editorScenesOf", () => {
    it("discards malformed and empty entries while preserving editor identities and valid footage", async () => {
        const subject = await buildSubject()

        expect(
            subject.editorScenesOf(
                [
                    null,
                    [],
                    { caption: " ", voiceover: "\n" },
                    {
                        id: " hook-1 ",
                        role: "hook",
                        caption: "  Fresh\nbread  ",
                        visual: " Bakery   counter ",
                        media: `${WS}/photo.jpg`,
                    },
                    { caption: "Offer", voiceover: 5, role: "unsupported", media: "other/photo.jpg" },
                    { id: 5, role: "cta", voiceover: "  Visit   today  ", media: " " },
                ],
                WS,
            ),
        ).toEqual([
            {
                id: "hook-1",
                role: "hook",
                caption: "Fresh bread",
                voiceover: "",
                visual: "Bakery counter",
                media: `${WS}/photo.jpg`,
            },
            { id: "scene-5", role: "body", caption: "Offer", voiceover: "", visual: "", media: null },
            { id: "scene-6", role: "cta", caption: "", voiceover: "Visit today", visual: "", media: null },
        ])
    })
})

describe("editorScenesOf", () => {
    it("limits every scene text field", async () => {
        const subject = await buildSubject()

        const media = `${WS}/${"m".repeat(320)}`

        expect(
            subject.editorScenesOf(
                [
                    {
                        id: "i".repeat(61),
                        role: "body",
                        caption: "c".repeat(161),
                        voiceover: "v".repeat(421),
                        visual: "f".repeat(241),
                        media,
                    },
                ],
                WS,
            ),
        ).toEqual([
            {
                id: "i".repeat(60),
                role: "body",
                caption: "c".repeat(160),
                voiceover: "v".repeat(420),
                visual: "f".repeat(240),
                media: media.slice(0, 300),
            },
        ])
    })

    it("limits processing to the first twelve stored entries", async () => {
        const subject = await buildSubject()

        const raw = Array.from({ length: 14 }, (_unused, index) => ({ caption: `Scene ${index + 1}` }))

        expect(subject.editorScenesOf(raw, WS)).toEqual(
            Array.from({ length: 12 }, (_unused, index) => ({
                id: `scene-${index + 1}`,
                role: "body",
                caption: `Scene ${index + 1}`,
                voiceover: "",
                visual: "",
                media: null,
            })),
        )
    })

    it("defaults non-array scripts to no scenes", async () => {
        const subject = await buildSubject()

        expect(subject.editorScenesOf({ caption: "Hello" }, WS)).toEqual([])
    })
})

describe("videoInstant", () => {
    it.each([new Date(INSTANT), INSTANT])("preserves the stored instant %s", async (instant) => {
        const subject = await buildSubject()

        expect(subject.videoInstant(instant)).toBe(INSTANT)
    })
})

describe("workbenchProjectOf", () => {
    it("maps the saved project and sanitizes its inputs and script", async () => {
        const subject = await buildSubject()

        expect(subject.workbenchProjectOf(rowOf(), WS, null)).toEqual({
            id: "project-1",
            title: "Spring offer",
            goal: "offer",
            aspect: "9:16",
            targetSeconds: 30,
            status: "ready",
            inputs: { sourceIds: [SOURCE], notes: "fresh bread", media: [], auto: true },
            script: [{ id: "hook-1", role: "hook", caption: "Fresh", voiceover: "", visual: "", media: `${WS}/a.jpg` }],
            version: 2,
            scriptMs: 900,
            lastErrorCode: null,
            render: null,
            renderCount: 2,
            approvedAt: null,
            approvedByName: null,
            publishedAt: null,
            createdAt: INSTANT,
            updatedAt: INSTANT,
        })
    })

    it.each([
        ["code:VIDEO_SCRIPT_FORMAT", "VIDEO_SCRIPT_FORMAT"],
        ["private provider failure", "VIDEO_PROJECT_FAILED"],
    ])("exposes only a stable code for %s", async (lastError, expectedCode) => {
        const subject = await buildSubject()

        const render: WorkbenchRender = {
            id: "render-1",
            status: "done",
            progress: 100,
            stage: null,
            durationMs: 30_000,
            sizeBytes: 2048,
            errorCode: null,
            videoUrl: "https://media/video",
            captionsUrl: null,
            captionsLang: null,
            downloadUrl: "https://media/download",
            posterUrl: null,
        }
        const row = rowOf({
            last_error: lastError,
            approved_at: new Date(INSTANT),
            approved_by_name: "Lan",
            published_at: INSTANT,
        })

        expect(subject.workbenchProjectOf(row, WS, render)).toEqual({
            ...subject.workbenchProjectOf(rowOf(), WS, null),
            lastErrorCode: expectedCode,
            approvedAt: INSTANT,
            approvedByName: "Lan",
            publishedAt: INSTANT,
            render,
        })
    })
})
