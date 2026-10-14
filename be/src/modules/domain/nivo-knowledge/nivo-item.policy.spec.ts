import { NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { nivoItemOf } from "./nivo-item.policy"

describe("nivoItemOf", () => {
    it.each(["playbook", "authority", "escalation", "setup_checklist", "tone"])(
        "reads the %s kind with the title, final filename and trimmed markdown body",
        (kind) => {
            expect(
                nivoItemOf(
                    {
                        path: "chatbot/nested/care.md",
                        text: `---\ntitle: Care\nkind: ${kind}\n---\n\n# Care\n\nFast.\n `,
                    },
                    ["core", "chatbot"],
                ),
            ).toEqual({
                kind: "ok",
                value: { module: "chatbot", slug: "care", title: "Care", kind, body: "# Care\n\nFast." },
            })
        },
    )

    it("normalizes CRLF, removes surrounding quotes and ignores lines without metadata", () => {
        expect(
            nivoItemOf(
                {
                    path: "core/tone.md",
                    text: "---\r\n# An ignored comment\r\ntitle: Old title\r\ntitle:  \"Warm voice\"  \r\nkind: 'tone'\r\nversion: 1\r\n---\r\n  Warm.\r\n",
                },
                ["core"],
            ),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "tone", title: "Warm voice", kind: "tone", body: "Warm." },
        })
    })

    it("accepts an empty body without a newline after the front matter", () => {
        expect(nivoItemOf({ path: "core/empty.md", text: "---\ntitle: Empty\nkind: tone\n---" }, ["core"])).toEqual({
            kind: "ok",
            value: { module: "core", slug: "empty", title: "Empty", kind: "tone", body: "" },
        })
    })

    it.each([
        { closing: "---# Care", body: "# Care" },
        { closing: "---\n# Care\n---\nStill the body.\n", body: "# Care\n---\nStill the body." },
    ])("uses the first closing delimiter and preserves the rest as the body: $closing", ({ closing, body }) => {
        expect(
            nivoItemOf({ path: "core/care.md", text: `---\ntitle: Care\nkind: playbook\n${closing}` }, ["core"]),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "care", title: "Care", kind: "playbook", body },
        })
    })

    it("strips only a lowercase markdown extension from the final filename", () => {
        expect(nivoItemOf({ path: "core/voice.MD", text: "---\ntitle: Voice\nkind: tone\n---\nHi" }, ["core"])).toEqual(
            {
                kind: "ok",
                value: { module: "core", slug: "voice.MD", title: "Voice", kind: "tone", body: "Hi" },
            },
        )
    })

    it.each(["No header", "---\ntitle: Care\nkind: tone", "---title: Care\nkind: tone\n---\nHi"])(
        "refuses malformed front matter: %s",
        (text) => {
            expect(nivoItemOf({ path: "core/voice.md", text }, ["core"])).toEqual({
                kind: "refused",
                code: NivoKnowledgeErrorCode.FrontMatterMissing,
                params: { file: "core/voice.md" },
            })
        },
    )

    it.each(["voice.md", "unknown/voice.md", ""])("refuses an unrecognized module path: %s", (path) => {
        expect(nivoItemOf({ path, text: "---\ntitle: Voice\nkind: tone\n---\nHi" }, ["core"])).toEqual({
            kind: "refused",
            code: NivoKnowledgeErrorCode.ModuleUnknown,
            params: { file: path },
        })
    })

    it.each(["title: Voice", "title: Voice\nkind: ", "title: Voice\nkind: other"])(
        "refuses missing, empty or unknown kinds: %s",
        (header) => {
            expect(nivoItemOf({ path: "core/voice.md", text: `---\n${header}\n---\nHi` }, ["core"])).toEqual({
                kind: "refused",
                code: NivoKnowledgeErrorCode.KindUnknown,
                params: { file: "core/voice.md" },
            })
        },
    )

    it.each(["kind: tone", "kind: tone\ntitle: ", "kind: tone\ntitle: ''"])(
        "refuses a missing or empty title: %s",
        (header) => {
            expect(nivoItemOf({ path: "core/voice.md", text: `---\n${header}\n---\nHi` }, ["core"])).toEqual({
                kind: "refused",
                code: NivoKnowledgeErrorCode.TitleMissing,
                params: { file: "core/voice.md" },
            })
        },
    )
})
