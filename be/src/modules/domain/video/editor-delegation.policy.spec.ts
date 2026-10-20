import { Test } from "@nestjs/testing"
import {
    channelNames,
    channelsOf,
    readDelegation,
    sceneLines,
    secondsOf,
    videoReadyCard,
} from "./editor-delegation.policy"
import type { EditorLabels, ReadyVideo } from "./editor-delegation.contracts"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const CONTENT = "1a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const SUBJECT = Symbol("editor-delegation.policy")

type Subject = {
    channelNames: typeof channelNames
    channelsOf: typeof channelsOf
    readDelegation: typeof readDelegation
    sceneLines: typeof sceneLines
    secondsOf: typeof secondsOf
    videoReadyCard: typeof videoReadyCard
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    channelNames,
                    channelsOf,
                    readDelegation,
                    sceneLines,
                    secondsOf,
                    videoReadyCard,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const LABELS: EditorLabels = {
    length: "Length",
    seconds: "15 s",
    aspect: "Aspect",
    captions: "Captions",
    captionsOn: "Yes",
    captionsOff: "Burned in",
    voice: "Voice",
    voiceValue: "Captions only",
    channels: "Channels",
    noChannels: "No channel",
    poster: "Poster",
    link: "Open project",
    frame: "Brand frame",
    frameOn: "Applied",
    approvalBody: "Posted only after approval.",
    approvalBadge: "Needs approval",
}

const VIDEO: ReadyVideo = {
    delegationId: "delegation-1",
    projectId: "project-1",
    renderId: "render-1",
    title: "Weekend",
    aspect: "9:16",
    scenes: [
        { caption: "A quiet moment", voiceover: "", media: null },
        { caption: "", voiceover: "Let go", media: null },
        { caption: "20% off", voiceover: "", media: null },
    ],
    durationMs: 15_000,
    channels: ["facebook", "zalo"],
    source: "content",
    videoUrl: "https://storage/v.mp4",
    posterUrl: "https://storage/p.jpg",
    captionsUrl: "https://storage/c.vtt",
    captionsLang: "vi-VN",
    href: "/agents/video/workbench?focus=project-1",
}

describe("readDelegation", () => {
    it("reads a delegated script with its channels, shape, goal and content item", async () => {
        const subject = await build()

        const read = subject.readDelegation(
            {
                title: "  Weekend  ",
                script: JSON.stringify([
                    { caption: "A", voiceover: "a", media: `${WORKSPACE}/a.jpg` },
                    { caption: "B", voiceover: "", media: "elsewhere/b.jpg" },
                ]),
                channels: '["facebook","Zalo","fax","facebook"]',
                brand_kit_id: WORKSPACE,
                aspect: "1:1",
                goal: "service",
                source: "content",
                content_item_id: CONTENT,
            },
            WORKSPACE,
        )

        expect(read).toEqual({
            title: "Weekend",
            scenes: [
                { caption: "A", voiceover: "a", media: `${WORKSPACE}/a.jpg` },
                { caption: "B", voiceover: "", media: null },
            ],
            channels: ["facebook", "zalo"],
            source: "content",
            aspect: "1:1",
            goal: "service",
            targetSeconds: 10,
            contentItemId: CONTENT,
        })
    })

    it("falls back to AI Marketing, 9:16, an offer and no content item", async () => {
        const subject = await build()

        const read = subject.readDelegation(
            {
                title: "Title",
                script: Array.from({ length: 20 }, () => ({ caption: "x", voiceover: "", media: null })),
                aspect: "4:3",
                goal: "party",
                content_item_id: "not-a-uuid",
                channels: 7,
            },
            WORKSPACE,
        )

        expect(read).toMatchObject({
            source: "content",
            aspect: "9:16",
            goal: "offer",
            contentItemId: null,
            channels: [],
            targetSeconds: 60,
        })
    })

    it.each([
        [{ title: "", script: '[{"caption":"A"}]' }],
        [{ title: "T", script: "not json" }],
        [{ title: "T", script: "[]" }],
        [{ title: "T", script: '[{"caption":"A"}]', brand_kit_id: "another-workspace" }],
    ])("refuses a script that cannot be rendered", async (fields) => {
        const subject = await build()

        expect(subject.readDelegation(fields, WORKSPACE)).toBeNull()
    })
})

describe("channelsOf", () => {
    it("reads comma separated text and a list", async () => {
        const subject = await build()

        expect(subject.channelsOf("facebook, zalo")).toEqual(["facebook", "zalo"])
        expect(subject.channelsOf(["tiktok", 3])).toEqual(["tiktok"])
    })
})

describe("channelNames", () => {
    it("names the known channels and keeps any other as it is", async () => {
        const subject = await build()

        expect(subject.channelNames(["facebook", "zalo", "web"])).toBe("Facebook + Zalo OA + web")
    })
})

describe("sceneLines and secondsOf", () => {
    it("shares the length between the scenes and shows the spoken words of a scene without a caption", async () => {
        const subject = await build()

        expect(subject.sceneLines(VIDEO.scenes, 15)).toEqual([
            { at: "00\u201305s", text: "A quiet moment" },
            { at: "05\u201310s", text: "Let go" },
            { at: "10\u201315s", text: "20% off" },
        ])
        expect(subject.sceneLines([], 15)).toEqual([])
        expect(subject.secondsOf(14_600)).toBe(15)
        expect(subject.secondsOf(null)).toBe(1)
    })
})

describe("videoReadyCard", () => {
    it("is a v1 video_ready card with the clip, the poster, the facts and the scene lines", async () => {
        const subject = await build()

        const card = subject.videoReadyCard(VIDEO, LABELS, "item-9")

        expect(card).toMatchObject({
            v: 1,
            type: "video_ready",
            title: "Weekend",
            subtitle: "15 s \u00b7 9:16 \u00b7 Facebook + Zalo OA",
            badge: "Needs approval",
            body: "Posted only after approval.",
            fields: [
                { label: "Length", value: "15 s" },
                { label: "Aspect", value: "9:16" },
                { label: "Captions", value: "Yes" },
                { label: "Voice", value: "Captions only" },
                { label: "Brand frame", value: "Applied" },
                { label: "Channels", value: "Facebook + Zalo OA" },
            ],
            media: [
                { kind: "video", url: "https://storage/v.mp4", caption: "15 s \u00b7 9:16" },
                { kind: "image", url: "https://storage/p.jpg", caption: "Poster" },
            ],
            link: { label: "Open project", href: "/agents/video/workbench?focus=project-1" },
            ref: { kind: "work_item", id: "item-9" },
            actions: ["approve", "decline"],
            data: { project_id: "project-1", render_id: "render-1", captions_url: "https://storage/c.vtt" },
        })
        expect(card.lines).toHaveLength(3)
    })

    it("says when there is no captions file, no poster and no channel", async () => {
        const subject = await build()

        const card = subject.videoReadyCard(
            { ...VIDEO, captionsUrl: null, posterUrl: null, channels: [] },
            LABELS,
            "item-9",
        )

        expect(card.subtitle).toBe("15 s \u00b7 9:16")
        expect(card.fields).toEqual(
            expect.arrayContaining([
                { label: "Captions", value: "Burned in" },
                { label: "Channels", value: "No channel" },
            ]),
        )
        expect(card.media).toHaveLength(1)
    })
})
