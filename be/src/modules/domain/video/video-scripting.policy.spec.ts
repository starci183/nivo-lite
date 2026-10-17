import { Test } from "@nestjs/testing"
import {
    extractVideoScriptJson,
    parseVideoScript,
    videoScriptProgress,
    videoScriptRoleAt,
} from "./video-scripting.policy"

const SUBJECT = Symbol("video-scripting.policy")

type Subject = Pick<
    typeof import("./video-scripting.policy"),
    "extractVideoScriptJson" | "parseVideoScript" | "videoScriptProgress" | "videoScriptRoleAt"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    extractVideoScriptJson,
                    parseVideoScript,
                    videoScriptProgress,
                    videoScriptRoleAt,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WS = "workspace-1"

describe("extractVideoScriptJson", () => {
    it.each([
        ["no object", "An answer without JSON", null],
        ["truncated object", '{"scenes":[{"caption":"Hello"}', null],
        ["truncated quoted value", '{"title":"unfinished', null],
        ["code fences and prose", 'Before ```json\n{"title":"Hello"}\n``` after', '{"title":"Hello"}'],
        [
            "escaped quotes and backslashes",
            '{"text":"a \\"quote\\" and \\\\ path ] }"}',
            '{"text":"a \\"quote\\" and \\\\ path ] }"}',
        ],
        ["missing array closer", '{"scenes":[1,2}', '{"scenes":[1,2]}'],
        ["missing nested object closer", '{"scenes":[{"caption":"Hello"]}', '{"scenes":[{"caption":"Hello"}]}'],
        ["trailing comma", '{"title":"Hello",  }', '{"title":"Hello"}'],
        ["unmatched closer", '{"count":]1}', '{"count":1}'],
    ] as const)("extracts %s", async (_label, text, expected) => {
        const subject = await build()

        expect(subject.extractVideoScriptJson(text)).toBe(expected)
    })
})

describe("parseVideoScript", () => {
    it.each([
        ["no JSON", "No generated script"],
        ["invalid JSON", "{not valid JSON}"],
        ["no scenes", '{"scenes":{}}'],
        ["one usable scene", '{"scenes":[null,{"caption":"Hello"},{"caption":" "}]}'],
    ])("refuses %s", async (_label, text) => {
        const subject = await build()

        expect(subject.parseVideoScript(text, "generation-1", WS)).toBeNull()
    })

    it("normalizes the title and assigns generation identities and story roles without trusting media", async () => {
        const subject = await build()

        const text = JSON.stringify({
            title: "  Spring   offer\nfor everyone  ",
            scenes: [
                null,
                { id: "provider-id", role: "cta", caption: "  Fresh   bread ", media: `${WS}/provider.jpg` },
                { caption: "Daily", voiceover: "  Baked\nfresh ", visual: "  Bakery   counter  ", role: "hook" },
                { voiceover: "Visit today", role: "body", media: "other-workspace/picture.jpg" },
            ],
        })

        expect(subject.parseVideoScript(text, "generation-1", WS)).toEqual({
            title: "Spring offer for everyone",
            scenes: [
                { id: "generation-1-1", role: "hook", caption: "Fresh bread", voiceover: "", visual: "", media: null },
                {
                    id: "generation-1-2",
                    role: "body",
                    caption: "Daily",
                    voiceover: "Baked fresh",
                    visual: "Bakery counter",
                    media: null,
                },
                { id: "generation-1-3", role: "cta", caption: "", voiceover: "Visit today", visual: "", media: null },
            ],
        })
    })

    it.each([
        ["a long title", "x".repeat(121), "x".repeat(120)],
        ["a non-text title", 5, ""],
    ])("limits %s", async (_label, title, expected) => {
        const subject = await build()

        expect(
            subject.parseVideoScript(
                JSON.stringify({ title, scenes: [{ caption: "One" }, { caption: "Two" }] }),
                "g",
                WS,
            ),
        ).toEqual({
            title: expected,
            scenes: [
                { id: "g-1", role: "hook", caption: "One", voiceover: "", visual: "", media: null },
                { id: "g-2", role: "cta", caption: "Two", voiceover: "", visual: "", media: null },
            ],
        })
    })
})

describe("videoScriptRoleAt", () => {
    it.each([
        [0, 1, "hook"],
        [1, 3, "body"],
        [2, 3, "cta"],
    ] as const)("assigns scene %i of %i the %s role", async (index, count, expected) => {
        const subject = await build()

        expect(subject.videoScriptRoleAt(index, count)).toBe(expected)
    })
})

describe("videoScriptProgress", () => {
    it.each([
        ["queued", { status: "queued", progress: 0 }],
        ["running", { status: "running", progress: 50 }],
        ["done", { status: "running", progress: 50 }],
    ] as const)("keeps %s pending until domain completion", async (status, expected) => {
        const subject = await build()

        expect(subject.videoScriptProgress(status)).toEqual(expected)
    })
})
