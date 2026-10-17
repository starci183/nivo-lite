import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { VideoScriptingRow } from "./persistence/video-scripting.rows"
import { videoScriptMessages, videoScriptSourcesText } from "./video-scripting-prompt.policy"
import { VIDEO_SCRIPT_GOALS, VIDEO_SCRIPT_SYSTEM } from "./video-scripting.templates"

const SUBJECT = Symbol("video-scripting-prompt.policy")
type Subject = {
    videoScriptSourcesText: typeof videoScriptSourcesText
    videoScriptMessages: typeof videoScriptMessages
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { videoScriptSourcesText, videoScriptMessages } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WS = "workspace-1"
const projectOf = builder<VideoScriptingRow>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "draft",
    inputs: { notes: " fresh bread ", media: [`${WS}/bread.jpg`, "other/private.jpg"] },
    script_meta: {},
    updated_at: "2026-10-13T09:00:00.000Z",
    render_status: null,
    workspace_name: " Bakery ",
    shop_name: " Bread shop ",
})

describe("videoScriptSourcesText", () => {
    it("retains public titles and topics while normalizing whitespace and skipping blank bodies", async () => {
        const subject = await build()

        expect(
            subject.videoScriptSourcesText([
                { title: "Empty", topic: "Ignored", content: " \t\n " },
                { title: "Menu", topic: null, content: " \tBread\t  20k\n\n\n\nCoffee 30k  " },
                { title: "Opening", topic: "Hours", content: " Open daily " },
            ]),
        ).toBe("### Menu\nBread 20k\n\nCoffee 30k\n\n### Hours / Opening\nOpen daily")
    })

    it("answers empty text for no selected documents", async () => {
        const subject = await build()

        expect(subject.videoScriptSourcesText([])).toBe("")
    })

    it("limits each body to 1600 characters and stops after the 5200-character body budget", async () => {
        const subject = await build()

        expect(
            subject.videoScriptSourcesText([
                { title: "A", topic: null, content: "a".repeat(1700) },
                { title: "B", topic: null, content: "b".repeat(1700) },
                { title: "C", topic: null, content: "c".repeat(1700) },
                { title: "D", topic: null, content: "d".repeat(1700) },
                { title: "E", topic: null, content: "Must not enter the prompt" },
            ]),
        ).toBe(
            [
                "### A\n",
                "a".repeat(1600),
                "\n\n### B\n",
                "b".repeat(1600),
                "\n\n### C\n",
                "c".repeat(1600),
                "\n\n### D\n",
                "d".repeat(400),
            ].join(""),
        )
    })
})

describe("videoScriptMessages", () => {
    afterEach(() => jest.restoreAllMocks())

    it.each([
        { label: "empty outline", scenes: [], outline: "1. HOOK: \n2. BODY: \n3. CTA: " },
        {
            label: "missing body",
            scenes: [
                { role: "hook", brief: "Open" },
                { role: "cta", brief: "Visit" },
            ],
            outline: "1. HOOK: Open\n2. BODY: \n3. CTA: Visit",
        },
        {
            label: "missing ends",
            scenes: [{ role: "body", brief: "Main message" }],
            outline: "1. HOOK: \n2. BODY: Main message\n3. CTA: ",
        },
    ])("uses an empty brief for a template with $label", async ({ scenes, outline }) => {
        const subject = await build()

        jest.replaceProperty(VIDEO_SCRIPT_GOALS, "custom", {
            label: { vi: "Audit goal" },
            hint: { vi: "Use supplied brief." },
            scenes,
        })

        expect(
            subject.videoScriptMessages(projectOf({ goal: "custom", target_seconds: 6, inputs: {} }), WS, "", "Facts"),
        ).toEqual([
            { role: "system", content: `${VIDEO_SCRIPT_SYSTEM}\n\nPUBLIC SHOP CONTEXT:\nFacts` },
            {
                role: "user",
                content: [
                    "SHOP: Bread shop",
                    "GOAL: Audit goal. Use supplied brief.",
                    "FORMAT: 9:16, about 6 seconds in total.",
                    "SCENES: exactly 3. Each voiceover about 40 characters, never above 70.",
                    `OUTLINE:\n${outline}`,
                    "No selected public facts: keep claims general.",
                    "The owner supplied 0 images or clips. Suggest what to show in each scene.",
                    "Return the JSON object now.",
                ].join("\n\n"),
            },
        ])
    })
})

describe("videoScriptMessages", () => {
    afterEach(() => jest.restoreAllMocks())

    it("builds the offer outline with public context, owner notes and workspace media", async () => {
        const subject = await build()

        expect(subject.videoScriptMessages(projectOf(), WS, "Bread 20k", "Warm shop voice")).toEqual([
            { role: "system", content: `${VIDEO_SCRIPT_SYSTEM}\n\nPUBLIC SHOP CONTEXT:\nWarm shop voice` },
            {
                role: "user",
                content: [
                    "SHOP: Bread shop",
                    [
                        "GOAL: \u01afu \u0111\u00e3i. B\u00e1o \u01b0u \u0111\u00e3i \u0111ang c\u00f3, ",
                        "\u0111\u00fang th\u1eddi h\u1ea1n v\u00e0 \u0111i\u1ec1u ki\u1ec7n b\u1ea1n \u0111\u00e3 ",
                        "ghi.",
                    ].join(""),
                    "FORMAT: 9:16, about 30 seconds in total.",
                    "SCENES: exactly 5. Each voiceover about 73 characters, never above 103.",
                    [
                        "OUTLINE:\n1. HOOK: M\u1edf b\u1eb1ng \u01b0u \u0111\u00e3i n\u1ed5i b\u1eadt nh\u1ea5t, ",
                        "ng\u1eafn g\u1ecdn, \u0111\u00fang con s\u1ed1 \u0111\u00e3 ghi.\n2. BODY: \u01afu ",
                        "\u0111\u00e3i \u00e1p d\u1ee5ng cho g\u00ec, cho ai, \u0111i\u1ec1u ki\u1ec7n k\u00e8m ",
                        "theo.\n3. BODY: Th\u1eddi h\u1ea1n ho\u1eb7c s\u1ed1 l\u01b0\u1ee3ng c\u00f3 h\u1ea1n ",
                        "n\u1ebfu th\u00f4ng tin c\u00f3 ghi; kh\u00f4ng t\u1ef1 th\u00eam khan hi\u1ebfm ",
                        "gi\u1ea3.\n4. BODY: \u01afu \u0111\u00e3i \u00e1p d\u1ee5ng cho g\u00ec, cho ai, ",
                        "\u0111i\u1ec1u ki\u1ec7n k\u00e8m theo.\n5. CTA: K\u00eau g\u1ecdi h\u00e0nh ",
                        "\u0111\u1ed9ng r\u00f5 r\u00e0ng: nh\u1eafn tin, g\u1ecdi, ho\u1eb7c \u0111\u1eb7t ",
                        "l\u1ecbch tr\u01b0\u1edbc h\u1ea1n.",
                    ].join(""),
                    "THE OWNER WANTS TO STRESS: fresh bread",
                    "INFORMATION:\nBread 20k",
                    "The owner supplied 1 images or clips. Suggest what to show in each scene.",
                    "Return the JSON object now.",
                ].join("\n\n"),
            },
        ])
    })

    it.each([null, "   "])("uses the workspace and custom goal when the shop name is %p", async (shopName) => {
        const subject = await build()

        expect(
            subject.videoScriptMessages(
                projectOf({ goal: "legacy", shop_name: shopName, target_seconds: 6, inputs: {} }),
                WS,
                "",
                "",
            ),
        ).toEqual([
            { role: "system", content: `${VIDEO_SCRIPT_SYSTEM}\n\nPUBLIC SHOP CONTEXT:\n` },
            {
                role: "user",
                content: [
                    "SHOP: Bakery",
                    [
                        "GOAL: Tu\u1ef3 ch\u1ec9nh. B\u1ea1n t\u1ef1 n\u00f3i video n\u00e0y \u0111\u1ec3 l\u00e0m ",
                        "g\u00ec, NIVO so\u1ea1n theo.",
                    ].join(""),
                    "FORMAT: 9:16, about 6 seconds in total.",
                    "SCENES: exactly 3. Each voiceover about 40 characters, never above 70.",
                    [
                        "OUTLINE:\n1. HOOK: M\u1edf b\u1eb1ng \u0111i\u1ec1u kh\u00e1ch quan t\u00e2m nh\u1ea5t ",
                        "li\u00ean quan \u0111\u1ebfn m\u1ee5c \u0111\u00edch b\u1ea1n n\u00eau.\n2. BODY: ",
                        "Th\u00f4ng \u0111i\u1ec7p ch\u00ednh c\u1ee7a video, m\u1ed9t \u00fd duy nh\u1ea5t.\n3. ",
                        "CTA: M\u1ed9t h\u00e0nh \u0111\u1ed9ng r\u00f5 r\u00e0ng kh\u00e1ch l\u00e0m ti\u1ebfp ",
                        "theo.",
                    ].join(""),
                    "No selected public facts: keep claims general.",
                    "The owner supplied 0 images or clips. Suggest what to show in each scene.",
                    "Return the JSON object now.",
                ].join("\n\n"),
            },
        ])
    })
})

describe("videoScriptMessages", () => {
    afterEach(() => jest.restoreAllMocks())

    it("caps long videos at eight scenes while cycling the goal's body instructions", async () => {
        const subject = await build()

        expect(
            subject.videoScriptMessages(
                projectOf({ goal: "custom", target_seconds: 120, inputs: {} }),
                WS,
                "",
                "Facts",
            ),
        ).toEqual([
            { role: "system", content: `${VIDEO_SCRIPT_SYSTEM}\n\nPUBLIC SHOP CONTEXT:\nFacts` },
            {
                role: "user",
                content: [
                    "SHOP: Bread shop",
                    [
                        "GOAL: Tu\u1ef3 ch\u1ec9nh. B\u1ea1n t\u1ef1 n\u00f3i video n\u00e0y \u0111\u1ec3 l\u00e0m ",
                        "g\u00ec, NIVO so\u1ea1n theo.",
                    ].join(""),
                    "FORMAT: 9:16, about 120 seconds in total.",
                    "SCENES: exactly 8. Each voiceover about 199 characters, never above 229.",
                    [
                        "OUTLINE:\n1. HOOK: M\u1edf b\u1eb1ng \u0111i\u1ec1u kh\u00e1ch quan t\u00e2m nh\u1ea5t ",
                        "li\u00ean quan \u0111\u1ebfn m\u1ee5c \u0111\u00edch b\u1ea1n n\u00eau.\n2. BODY: ",
                        "Th\u00f4ng \u0111i\u1ec7p ch\u00ednh c\u1ee7a video, m\u1ed9t \u00fd duy nh\u1ea5t.\n3. ",
                        "BODY: Th\u00f4ng tin h\u1ed7 tr\u1ee3 c\u00f3 th\u1eadt (l\u00fd do, b\u1eb1ng ",
                        "ch\u1ee9ng, chi ti\u1ebft).\n4. BODY: Th\u00f4ng \u0111i\u1ec7p ch\u00ednh c\u1ee7a ",
                        "video, m\u1ed9t \u00fd duy nh\u1ea5t.\n5. BODY: Th\u00f4ng tin h\u1ed7 tr\u1ee3 c\u00f3 ",
                        "th\u1eadt (l\u00fd do, b\u1eb1ng ch\u1ee9ng, chi ti\u1ebft).\n6. BODY: Th\u00f4ng ",
                        "\u0111i\u1ec7p ch\u00ednh c\u1ee7a video, m\u1ed9t \u00fd duy nh\u1ea5t.\n7. BODY: ",
                        "Th\u00f4ng tin h\u1ed7 tr\u1ee3 c\u00f3 th\u1eadt (l\u00fd do, b\u1eb1ng ch\u1ee9ng, chi ",
                        "ti\u1ebft).\n8. CTA: M\u1ed9t h\u00e0nh \u0111\u1ed9ng r\u00f5 r\u00e0ng kh\u00e1ch ",
                        "l\u00e0m ti\u1ebfp theo.",
                    ].join(""),
                    "No selected public facts: keep claims general.",
                    "The owner supplied 0 images or clips. Suggest what to show in each scene.",
                    "Return the JSON object now.",
                ].join("\n\n"),
            },
        ])
    })
})
