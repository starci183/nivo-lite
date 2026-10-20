import type * as SubjectModule from "./nivo-item.policy"
import { Test } from "@nestjs/testing"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { NivoKnowledgeError, NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { CORE_FOLDER, nivoItemOf } from "./nivo-item.policy"
import fixtures from "./nivo-item.policy.fixtures.json"
import { NIVO_KNOWLEDGE_FILES } from "./nivo-knowledge.templates"

const SUBJECT = Symbol("nivo-item.policy")
type Subject = Pick<typeof SubjectModule, "nivoItemOf">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { nivoItemOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("nivoItemOf", () => {
    // Generated once by running the policy at 5da5cdf4^1, including its private metadata map.
    // The lint canon forbids source reads in unit specs, so the fixture embeds the shipped virtual Markdown files.
    it("preserves all 59 shipped inputs and the folders passed by the seed service", () => {
        expect([CORE_FOLDER, ...MODULE_CATALOG.map((module) => module.knowledgeFolder)]).toEqual(fixtures.folders)
        expect([...NIVO_KNOWLEDGE_FILES].sort((a, b) => a.path.localeCompare(b.path))).toEqual(
            fixtures.templates.map(({ file }) => file),
        )
        expect(fixtures.templates).toHaveLength(59)
    })

    it.each(fixtures.templates)("equals the old parser for shipped template $file.path", async ({ file, expected }) => {
        const subject = await buildSubject()

        const shipped = NIVO_KNOWLEDGE_FILES.find((candidate) => candidate.path === file.path)
        if (shipped === undefined) {
            throw new NivoKnowledgeError({
                code: NivoKnowledgeErrorCode.FrontMatterMissing,
                params: { file: file.path },
            })
        }
        const metadata = jest.spyOn(Map.prototype, "set")
        try {
            const outcome = subject.nivoItemOf(shipped, fixtures.folders)
            expect(outcome).toEqual(expected.outcome)
            expect(metadata.mock.calls).toEqual(expected.meta)
        } finally {
            metadata.mockRestore()
        }
    })

    it.each(fixtures.edges)("equals the old parser for edge case: $name", async ({ file, folders, expected }) => {
        const subject = await buildSubject()

        const metadata = jest.spyOn(Map.prototype, "set")
        try {
            const outcome = subject.nivoItemOf(file, folders)
            expect(outcome).toEqual(expected.outcome)
            expect(metadata.mock.calls).toEqual(expected.meta)
        } finally {
            metadata.mockRestore()
        }
    })

    it.each(["playbook", "authority", "escalation", "setup_checklist", "tone"])(
        "reads the %s kind with the title, final filename and trimmed markdown body",
        async (kind) => {
            const subject = await buildSubject()

            expect(
                subject.nivoItemOf(
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
})

describe("nivoItemOf", () => {
    it("normalizes CRLF, removes surrounding quotes and ignores lines without metadata", async () => {
        const subject = await buildSubject()

        expect(
            subject.nivoItemOf(
                {
                    path: "core/tone.md",
                    text:
                        '---\r\n# An ignored comment\r\ntitle: Old title\r\ntitle:  "Warm voice"  \r\nkind: ' +
                        "'tone'\r\nversion: 1\r\n---\r\n  Warm.\r\n",
                },
                ["core"],
            ),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "tone", title: "Warm voice", kind: "tone", body: "Warm." },
        })
    })

    it("accepts an empty body without a newline after the front matter", async () => {
        const subject = await buildSubject()

        expect(
            subject.nivoItemOf({ path: "core/empty.md", text: "---\ntitle: Empty\nkind: tone\n---" }, ["core"]),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "empty", title: "Empty", kind: "tone", body: "" },
        })
    })

    it("refuses an empty front matter block as a missing kind", async () => {
        const subject = await buildSubject()

        expect(subject.nivoItemOf({ path: "core/empty.md", text: "---\n\n---" }, ["core"])).toEqual({
            kind: "refused",
            code: NivoKnowledgeErrorCode.KindUnknown,
            params: { file: "core/empty.md" },
        })
    })

    it.each([
        { path: "core/", folders: ["core"], module: "core", slug: "" },
        { path: "/tone.md", folders: [""], module: "", slug: "tone" },
        { path: "/", folders: [""], module: "", slug: "" },
    ])("preserves empty path components: $path", async ({ path, folders, module, slug }) => {
        const subject = await buildSubject()

        expect(subject.nivoItemOf({ path, text: "---\ntitle: Voice\nkind: tone\n---" }, folders)).toEqual({
            kind: "ok",
            value: { module, slug, title: "Voice", kind: "tone", body: "" },
        })
    })

    it("trims metadata whitespace that includes Unicode line separators", async () => {
        const subject = await buildSubject()

        expect(
            subject.nivoItemOf(
                { path: "core/tone.md", text: "---\ntitle:\u2028\u2029Voice  \nkind:\u000btone\u000c\n---" },
                ["core"],
            ),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "tone", title: "Voice", kind: "tone", body: "" },
        })
    })
})

describe("nivoItemOf", () => {
    it.each([
        { closing: "---# Care", body: "# Care" },
        { closing: "---\n# Care\n---\nStill the body.\n", body: "# Care\n---\nStill the body." },
    ])("uses the first closing delimiter and preserves the rest as the body: $closing", async ({ closing, body }) => {
        const subject = await buildSubject()

        expect(
            subject.nivoItemOf({ path: "core/care.md", text: `---\ntitle: Care\nkind: playbook\n${closing}` }, [
                "core",
            ]),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "care", title: "Care", kind: "playbook", body },
        })
    })
})

describe("nivoItemOf", () => {
    it("strips only a lowercase markdown extension from the final filename", async () => {
        const subject = await buildSubject()

        expect(
            subject.nivoItemOf({ path: "core/voice.MD", text: "---\ntitle: Voice\nkind: tone\n---\nHi" }, ["core"]),
        ).toEqual({
            kind: "ok",
            value: { module: "core", slug: "voice.MD", title: "Voice", kind: "tone", body: "Hi" },
        })
    })

    it.each(["No header", "---\ntitle: Care\nkind: tone", "---title: Care\nkind: tone\n---\nHi"])(
        "refuses malformed front matter: %s",
        async (text) => {
            const subject = await buildSubject()

            expect(subject.nivoItemOf({ path: "core/voice.md", text }, ["core"])).toEqual({
                kind: "refused",
                code: NivoKnowledgeErrorCode.FrontMatterMissing,
                params: { file: "core/voice.md" },
            })
        },
    )

    it.each(["voice.md", "unknown/voice.md", ""])("refuses an unrecognized module path: %s", async (path) => {
        const subject = await buildSubject()

        expect(subject.nivoItemOf({ path, text: "---\ntitle: Voice\nkind: tone\n---\nHi" }, ["core"])).toEqual({
            kind: "refused",
            code: NivoKnowledgeErrorCode.ModuleUnknown,
            params: { file: path },
        })
    })

    it.each(["title: Voice", "title: Voice\nkind: ", "title: Voice\nkind: other"])(
        "refuses missing, empty or unknown kinds: %s",
        async (header) => {
            const subject = await buildSubject()

            expect(subject.nivoItemOf({ path: "core/voice.md", text: `---\n${header}\n---\nHi` }, ["core"])).toEqual({
                kind: "refused",
                code: NivoKnowledgeErrorCode.KindUnknown,
                params: { file: "core/voice.md" },
            })
        },
    )

    it.each([
        "kind: tone",
        "kind: tone\ntitle: ",
        "kind: tone\ntitle: ''",
        "kind: tone\ntitle: One\u2028Two",
        "kind: tone\ntitle: Voice\u2029",
    ])("refuses a missing or empty title: %s", async (header) => {
        const subject = await buildSubject()

        expect(subject.nivoItemOf({ path: "core/voice.md", text: `---\n${header}\n---\nHi` }, ["core"])).toEqual({
            kind: "refused",
            code: NivoKnowledgeErrorCode.TitleMissing,
            params: { file: "core/voice.md" },
        })
    })
})
