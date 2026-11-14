import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { PassageRetrievalService } from "@modules/domain/knowledge"
import type { PassageFound, PassageReadAnswer } from "@modules/domain/knowledge"
import { ToolsErrorCode } from "@modules/domain/tools"
import { viewOfCall } from "./native-view.policy"
import { NativeViewService } from "./native-view.service"
import {
    HELD_MARK,
    HELD_NOTICE,
    NO_HITS_NOTICE,
    PASSAGE_NOTICE,
    SNIPPET_CHARS,
    WEAK_HITS_NOTICE,
    snippetOf,
} from "./passage-native.policy"
import { PASSAGE_MANIFEST, PassageNativeService } from "./passage-native.service"
import {
    CALL_PHONE_OR_MAIL_MASKED_VI,
    CALL_PHONE_OR_MAIL_VI,
    CODE_PRICE_VI,
    DELIVERY_HOURS_TEXT_VI,
    DELIVERY_POLICY_SNIPPET_VI,
    DELIVERY_POLICY_TEXT_VI,
    DELIVERY_POLICY_TITLE_VI,
    DOC_LEAD_VI,
    DOC_TAIL_VI,
    FEE_SENTENCE_BROKEN_VI,
    FEE_SENTENCE_VI,
    HOW_MUCH_QUERY_VI,
    POLICY_WORD_VI,
    PRICE_35K_VI,
    SHORT_WORD_VI,
} from "@tests/fixtures/i18n/native-tools-spec.messages"

const WS = "11111111-1111-4111-8111-111111111111"
const P1 = "7f0c2b1e-3a4d-4c5e-8f60-112233445566"
const D1 = "b21e9d4c-5f6a-4b7c-9d8e-665544332211"
/** An internal agent outside any conversation, and the same agent answering a customer. */
const TEAM = { agentId: "a1", conversationId: null }
const FRONT = { agentId: "a1", conversationId: "conv-1" }

const CONTENT =
    DELIVERY_POLICY_TEXT_VI

const hit = (changes: Partial<PassageFound> = {}): PassageFound => ({
    id: P1,
    sourceId: D1,
    title: DELIVERY_POLICY_TITLE_VI,
    updatedAt: "2026-11-02T03:15:00.000Z",
    documentPassages: 48,
    order: 12,
    place: { kind: "page", label: "3" },
    module: null,
    visibility: "public",
    customerReady: true,
    legs: ["words", "meaning"],
    score: 1,
    complete: true,
    content: CONTENT,
    ...changes,
})

const stretch = (changes: Partial<PassageReadAnswer> = {}): PassageReadAnswer => ({
    sourceId: D1,
    title: DELIVERY_POLICY_TITLE_VI,
    updatedAt: "2026-11-02T03:15:00.000Z",
    documentPassages: 48,
    passages: [
        { id: "p11", order: 11, place: null, customerReady: true, content: DELIVERY_HOURS_TEXT_VI },
        { id: P1, order: 12, place: { kind: "page", label: "3" }, customerReady: false, content: CONTENT },
    ],
    prev: 10,
    next: 13,
    ...changes,
})

const build = async (module = "sales") => {
    const views = mock<NativeViewService>()
    views.of.mockImplementation((workspaceId, caller) =>
        Promise.resolve(viewOfCall(workspaceId, { module, installationId: null }, caller.conversationId)),
    )
    const retrieval = mock<PassageRetrievalService>()
    retrieval.search.mockResolvedValue({ legs: ["meaning", "words"], hits: [hit()], next: 6 })
    retrieval.read.mockResolvedValue(stretch())
    const moduleRef = await Test.createTestingModule({
        providers: [
            PassageNativeService,
            { provide: NativeViewService, useValue: views },
            { provide: PassageRetrievalService, useValue: retrieval },
        ],
    }).compile()
    return { service: moduleRef.get(PassageNativeService), retrieval }
}

const registerManifestCases = () => {
    it("names two read tools under the Brain's prefix, tainting, open to a customer-facing run, never a truth read", async () => {
        await build()

        expect(PASSAGE_MANIFEST.namespace).toBe("nivo.tool.brain")
        expect(PASSAGE_MANIFEST.tools.map((tool) => tool.name)).toEqual(["passage.search", "passage.read"])
        for (const tool of PASSAGE_MANIFEST.tools) {
            expect(tool).toMatchObject({ scope: "read", defaultMode: "auto", taints: true })
            expect(tool.internalOnly).toBeUndefined()
            expect(tool.readsTruths).toBeUndefined()
        }
    })
}

const registerSearchCases = () => {
    it("answers an internal reader compact hits: the cite, the position, the day, how it was found and a snippet", async () => {
        const { service, retrieval } = await build()

        const answer = await service.invoke(WS, "passage.search", { query: "phi ship noi thanh" }, TEAM)

        expect(answer).toEqual({
            notice: PASSAGE_NOTICE,
            legs: ["meaning", "words"],
            hits: [
                {
                    id: P1,
                    doc: D1,
                    title: DELIVERY_POLICY_TITLE_VI,
                    at: 12,
                    of: 48,
                    place: "page 3",
                    updated: "2026-11-02",
                    ready: true,
                    by: "both",
                                        snippet: DELIVERY_POLICY_SNIPPET_VI,
                },
            ],
            next: 6,
        })
        expect(retrieval.search).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "internal", installationId: null },
            { query: "phi ship noi thanh", mode: "auto", limit: 6, after: 0, embedTimeoutMs: 2500 },
        )
        // A passage is never dressed as a truth: no fact, no version, no source of a truth.
        expect(JSON.stringify(answer)).not.toMatch(/"(facts|fact|v|src|disputed)"/u)
    })

    it("searches for a customer conversation in the customer lens and tells it no count and no release mark", async () => {
        const { service, retrieval } = await build()

        const answer = await service.invoke(WS, "passage.search", { query: "ship", mode: "words", limit: 3, after: 6 }, FRONT)

        expect(retrieval.search).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "customer", installationId: null },
            { query: "ship", mode: "words", limit: 3, after: 6, embedTimeoutMs: 2500 },
        )
        const hits = answer["hits"]
        const first: unknown = Array.isArray(hits) ? hits[0] : undefined
        expect(Object.keys(first ?? {})).toEqual(["id", "doc", "title", "at", "place", "updated", "by", "snippet"])
    })

    it("searches for a customer-facing agent in the customer lens even outside a conversation", async () => {
        const { service, retrieval } = await build("chatbot")

        await service.invoke(WS, "passage.search", { query: "ship" }, TEAM)

        expect(retrieval.search.mock.calls[0]?.[0]).toMatchObject({ audience: "customer" })
    })

    it("has nothing to search for a module outside the catalogue", async () => {
        const { service, retrieval } = await build("no-such-module")

        await expect(service.invoke(WS, "passage.search", { query: "ship" }, TEAM)).resolves.toEqual({
            notice: PASSAGE_NOTICE,
            legs: [],
            hits: [],
            next: null,
        })
        await expect(service.invoke(WS, "passage.read", { id: P1 }, TEAM)).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
        })
        expect(retrieval.search).not.toHaveBeenCalled()
        expect(retrieval.read).not.toHaveBeenCalled()
    })

    it("refuses arguments outside the schema and a tool it does not have", async () => {
        const { service } = await build()

        await expect(service.invoke(WS, "passage.search", { query: "" }, TEAM)).rejects.toBeDefined()
        await expect(service.invoke(WS, "passage.search", { query: "x", limit: 50 }, TEAM)).rejects.toBeDefined()
        await expect(service.invoke(WS, "passage.read", {}, TEAM)).rejects.toBeDefined()
        await expect(service.invoke(WS, "passage.list", {}, TEAM)).rejects.toBeDefined()
    })
}

const registerStrengthCases = () => {
    it("tells the agent in the result when a search is weak or empty, and how to search again or read on", async () => {
        const { service, retrieval } = await build()
        retrieval.search.mockResolvedValueOnce({ legs: ["meaning", "words"], hits: [hit({ complete: false })], next: null })
        retrieval.search.mockResolvedValueOnce({ legs: ["meaning", "words"], hits: [], next: null })

        const weak = await service.invoke(WS, "passage.search", { query: "ship bao nhieu" }, TEAM)
        const none = await service.invoke(WS, "passage.search", { query: "ship bao nhieu" }, TEAM)

        expect(weak).toMatchObject({ notice: `${PASSAGE_NOTICE} ${WEAK_HITS_NOTICE}` })
        expect(none).toMatchObject({ notice: `${PASSAGE_NOTICE} ${NO_HITS_NOTICE}`, hits: [] })
        expect(WEAK_HITS_NOTICE).toContain(TOOL.brainPassageRead)
    })
}

const registerReadCases = () => {
    it("answers an internal reader the passages whole, in order, with the document's cite and where to go on; a passage not released is marked by its stored state", async () => {
        const { service, retrieval } = await build()

        const answer = await service.invoke(WS, "passage.read", { id: P1, before: 1, after: 0 }, TEAM)

        expect(answer).toEqual({
            notice: `${PASSAGE_NOTICE} ${HELD_NOTICE}`,
            doc: { id: D1, title: DELIVERY_POLICY_TITLE_VI, updated: "2026-11-02", passages: 48 },
            passages: [
                { id: "p11", at: 11, ready: true, text: DELIVERY_HOURS_TEXT_VI },
                { id: P1, at: 12, place: "page 3", ready: false, text: `${HELD_MARK}${CONTENT}` },
            ],
            prev: 10,
            next: 13,
        })
        expect(retrieval.read).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "internal", installationId: null },
            { passageId: P1, before: 1, after: 0 },
        )
    })

    it("reads for a customer conversation in the customer lens: no passage count, no release mark", async () => {
        const { service, retrieval } = await build()

        const answer = await service.invoke(WS, "passage.read", { doc: D1, at: 11 }, FRONT)

        expect(retrieval.read).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "customer", installationId: null },
            { sourceId: D1, at: 11, before: 1, after: 1 },
        )
        expect(answer).toMatchObject({ doc: { id: D1, title: DELIVERY_POLICY_TITLE_VI, updated: "2026-11-02" } })
        expect(JSON.stringify(answer)).not.toMatch(/"(passages":\d|ready)/u)
    })

    it("tells a customer-facing reader nothing of a document it is served nothing of: not found, with no title, count or text", async () => {
        const { service, retrieval } = await build()
        // An internal document and a public document whose every passage is withheld read alike: the retrieval holds nothing.
        retrieval.read.mockResolvedValue(null)

        const refusal = await service.invoke(WS, "passage.read", { doc: D1, at: 0 }, FRONT).catch((cause: unknown) => cause)

        expect(refusal).toMatchObject({ code: ToolsErrorCode.NativeRefused, params: { reason: "not_found" } })
        expect(JSON.stringify(refusal)).not.toContain(POLICY_WORD_VI)
    })

    it("scrubs phone numbers and emails a document carries", async () => {
        const { service, retrieval } = await build()
        retrieval.read.mockResolvedValue(
            stretch({ passages: [{ id: "p1", order: 0, place: null, customerReady: true, content: CALL_PHONE_OR_MAIL_VI }] }),
        )

        const answer = await service.invoke(WS, "passage.read", { id: P1 }, TEAM)

        expect(answer).toMatchObject({ passages: [{ text: CALL_PHONE_OR_MAIL_MASKED_VI }] })
    })
}

const registerSnippetCases = () => {
    it("shows the stretch around the first word of the query, found without diacritics, one line, cut with marks", async () => {
        await build()
        const long = `${DOC_LEAD_VI.repeat(20)}${FEE_SENTENCE_BROKEN_VI}${DOC_TAIL_VI.repeat(40)}`

        const snippet = snippetOf(long, "phi ship")

        expect(snippet.startsWith("…")).toBe(true)
        expect(snippet.endsWith("…")).toBe(true)
        expect(snippet).toContain(FEE_SENTENCE_VI)
        expect([...snippet].length).toBeLessThanOrEqual(SNIPPET_CHARS + 2)
    })

    it("finds a number and a code as written, leaves out an excluded word, and opens at the start for a hit by meaning", async () => {
        await build()
        const long = `${"x ".repeat(200)}${CODE_PRICE_VI}${"y ".repeat(200)}`

        expect(snippetOf(long, '"SP-0123" -x')).toContain("SP-0123")
        expect(snippetOf(long, PRICE_35K_VI)).toContain(PRICE_35K_VI)
        expect(snippetOf(long, HOW_MUCH_QUERY_VI).startsWith("x x")).toBe(true)
        expect(snippetOf(SHORT_WORD_VI, "ngan")).toBe(SHORT_WORD_VI)
    })
}

describe("PassageNativeService", () => {
    describe("manifest", registerManifestCases)
    describe("passage.search", registerSearchCases)
    describe("passage.search strength", registerStrengthCases)
    describe("passage.read", registerReadCases)
    describe("snippet", registerSnippetCases)
})
