import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { Logger } from "@modules/platform/logging"
import { NATURE_PROMPT, NATURE_SCHEMA, NATURE_VERSION, tableKeyOf } from "./document-nature.policy"
import { DocumentNatureService } from "./document-nature.service"
import { DocumentPartsService } from "./document-parts.service"
import { INGESTION_TARGET } from "./ingestion-model.policy"
import { ModelJsonService } from "./model-json.service"

// Synthetic documents of a laundry (a trade of no test corpus).
const USAGE = { promptTokens: 900, completionTokens: 40, totalTokens: 940, costUsd: 0.002 }
const HEADER = "order | taken | items | total"
const ORDERS = [HEADER, "LD-7-11 | 2026-05-01 | 3 shirts | 60,000", "LD-7-12 | 2026-05-01 | 1 suit | 90,000"].join("\n")
const PRICES = "## Prices\n\nWashing and ironing a shirt costs 20,000 VND; a suit is dry-cleaned for 90,000 VND in three days."

const passageOf = (order: number, text: string): TruthPassage => ({
    id: `c${String(order)}`,
    order,
    text,
    hash: passageTextHashOf(text),
    triage: null,
    triageVersion: null,
    truthsVersion: null,
})

const reply = (text: string) => ({ text, model: "sonnet", usage: USAGE, parsed: null, retrieved: 0 })

const build = async () => {
    const ai = mock<AiService>()
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "provider" } : { ok: true, answer }
    })
    const extractions = mock<BrainExtractionsService>()
    const usage = mock<UsageMeterService>()
    const parts = mock<DocumentPartsService>()
    extractions.natureOf.mockResolvedValue({ reading: null, override: null })
    extractions.formMates.mockResolvedValue([])
    extractions.reopenAtTriage.mockResolvedValue([])
    const queue = mock<KnowledgeQueue>()
    const tx = fakeTransaction(mockEntityManager())
    usage.blockedBy.mockResolvedValue(false)
    parts.wholeOf.mockResolvedValue([DOC_SOURCE])
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentNatureService,
            ModelJsonService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: UsageMeterService, useValue: usage },
            { provide: DocumentPartsService, useValue: parts },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentNatureService), ai, extractions, usage, parts, queue, tx }
}

const source = docSourceOf({ title: "Laundry price list", storagePath: "ws/laundry/prices.md" })
const passages = [passageOf(0, PRICES), passageOf(1, ORDERS)]
const ANSWER = JSON.stringify({ nature: "rules", reason: "The shop's own prices", sections: {}, tables: { records: [1] } })

describe("DocumentNatureService: what a document is, judged once per text", () => {
    it("asks the strong model once on the document's map, saves the reading and gives the judgement its passages inherit", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(reply(ANSWER))

        const outcome = await t.service.natureFor(source, passages, "c1")

        expect(outcome).toEqual({
            kind: "ready",
            calls: 1,
            nature: { nature: "rules", sections: [], tables: { [tableKeyOf(HEADER)]: "records" }, by: "model" },
        })
        const request = t.ai.chat.mock.calls[0]?.[0]
        expect(request).toMatchObject({ target: INGESTION_TARGET })
        expect(request?.messages[0]).toMatchObject({ content: NATURE_PROMPT, cacheMark: true })
        // Structured output where the route has it (TRIAGE-5), at effort high with room to think.
        expect(request).toMatchObject({ outputSchema: NATURE_SCHEMA, budget: { effort: "high" } })
        expect(request?.messages[1]?.content).toContain("File type: md.")
        expect(t.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, DOC_SOURCE, expect.objectContaining({ nature: "rules", contentHash: "c1", version: NATURE_VERSION }))
        expect(t.usage.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "brain", module: "knowledge", tryNumber: 1 }))
    })

    it("makes no call for a text it already read; the founder's answer replaces the model's", async () => {
        const t = await build()
        const stored = { version: NATURE_VERSION, contentHash: "c1", nature: "reference", reason: "r", sections: [], tables: {}, by: "model" }
        t.extractions.natureOf.mockResolvedValue({ reading: stored, override: { nature: "rules", by: "Owner", at: "t" } })

        await expect(t.service.natureFor(source, passages, "c1")).resolves.toEqual({
            kind: "ready",
            calls: 0,
            nature: { nature: "rules", sections: [], tables: {}, by: "founder" },
        })
        expect(t.ai.chat).not.toHaveBeenCalled()
    })

    it("asks once more with its own answer when the answer cannot be read; still unreadable, every passage is triaged one by one", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValueOnce(reply("It is a price list.")).mockResolvedValueOnce(reply(ANSWER))
        await expect(t.service.natureFor(source, passages, "c1")).resolves.toMatchObject({ kind: "ready", calls: 2, nature: { nature: "rules" } })
        expect(t.ai.chat.mock.calls[1]?.[0].messages.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"])

        const u = await build()
        u.ai.chat.mockResolvedValue(reply('{"nature":"brochure"}'))
        await expect(u.service.natureFor(source, passages, "c1")).resolves.toMatchObject({
            kind: "ready",
            calls: 2,
            nature: { nature: "mixed", sections: [], by: "fallback" },
        })
        expect(u.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, DOC_SOURCE, expect.objectContaining({ by: "fallback" }))
    })

    it("is retried by the queue when the model did not answer at all, and waits with no call when the credit pool is empty", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(null)
        await expect(t.service.natureFor(source, passages, "c1")).resolves.toEqual({ kind: "retry" })
        expect(t.extractions.saveNature).not.toHaveBeenCalled()

        const u = await build()
        u.usage.blockedBy.mockResolvedValue(true)
        await expect(u.service.natureFor(source, passages, "c1")).resolves.toEqual({ kind: "blocked" })
        expect(u.ai.chat).not.toHaveBeenCalled()
    })

    it("a part that holds only tables another part of its file judged takes that judgement for no call (one call per export)", async () => {
        const t = await build()
        const first = { version: NATURE_VERSION, contentHash: "p1", nature: "records", reason: "Orders", sections: [], tables: { [tableKeyOf(HEADER)]: "records" }, by: "model" }
        t.parts.wholeOf.mockResolvedValue(["p1", DOC_SOURCE])
        t.extractions.natureOf.mockImplementation((_workspace, id) => Promise.resolve(id === "p1" ? { reading: first, override: null } : { reading: null, override: null }))

        const outcome = await t.service.natureFor(source, [passageOf(0, ORDERS), passageOf(1, ORDERS.replace("LD-7-11", "LD-7-13"))], "c2")

        expect(outcome).toMatchObject({ kind: "ready", calls: 0, nature: { nature: "records" } })
        expect(t.ai.chat).not.toHaveBeenCalled()
        expect(t.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, DOC_SOURCE, expect.objectContaining({ contentHash: "c2", nature: "records" }))
    })
})

describe("DocumentNatureService: parts of one file, like documents and self-contradiction (NATURE_VERSION 5, D-V-2)", () => {
    // Synthetic: a laundry's list of its own garments for sale (items, one per line, one pattern) and its service terms.
    const GOODS = Array.from({ length: 6 }, (_, index) => `- Apron A-${String(index + 1)}: cotton, white, size ${String(index + 1)}, 120,000 VND.`).join("\n")
    const goods = [passageOf(0, GOODS)]
    const answerOf = (nature: string, entries: string, evidence: ReadonlyArray<string> = []) =>
        JSON.stringify({ evidence, entries, nature, reason: "r", sections: {}, tables: {} })
    const storedOf = (over: Readonly<Record<string, unknown>>) => ({ version: NATURE_VERSION, contentHash: "x", nature: "reference", reason: "aprons", sections: [], tables: {}, by: "model", ...over })

    it("shows the other parts of the same file (this map version only) with entries and quotes; a part judged otherwise is not read as rules", async () => {
        const t = await build()
        t.parts.wholeOf.mockResolvedValue(["p1", DOC_SOURCE, "p3"])
        const readings: Readonly<Record<string, Record<string, unknown>>> = {
            p1: storedOf({ entries: "items", evidence: ["Apron A-9: linen, grey"] }),
            p3: storedOf({ version: NATURE_VERSION - 1, nature: "rules" }),
        }
        t.extractions.natureOf.mockImplementation((_workspace, id) => Promise.resolve({ reading: readings[id] ?? null, override: null }))
        t.ai.chat.mockResolvedValue(reply(answerOf("rules", "terms", ["Washing and ironing a shirt costs 20,000 VND"])))

        const outcome = await t.service.natureFor(source, passages, "c1")

        const prompt = t.ai.chat.mock.calls[0]?.[0].messages[1]?.content ?? ""
        expect(prompt).toContain("This text is part 2 of 3 of one file.")
        expect(prompt).toContain('OTHER PARTS OF THIS FILE\nPart 1: reference (entries: items) - aprons | quotes: "Apron A-9: linen, grey"')
        expect(prompt).not.toContain("Part 3")
        expect(outcome).toMatchObject({ kind: "ready", calls: 1, nature: { nature: "rules" } })
        expect(t.extractions.saveNature).toHaveBeenCalledWith(
            DOC_WS,
            DOC_SOURCE,
            expect.objectContaining({ entries: "terms", disagreesWith: [{ sourceId: "p1", nature: "reference", sameFile: true }] }),
        )
        // The sibling is told (the founder sees both) as a part of the same file, and stays what it was judged: nothing is reopened.
        expect(t.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, "p1", expect.objectContaining({ nature: "reference", disagreesWith: [{ sourceId: DOC_SOURCE, nature: "rules", sameFile: true }] }))
        expect(t.extractions.reopenAtTriage).not.toHaveBeenCalled()
    })

    it("a like document of ANOTHER file judged rules still reads this one as rules; one of an older map version is neither shown nor counted", async () => {
        const t = await build()
        t.extractions.formMates.mockResolvedValue([
            { sourceId: "o1", title: "Old terms", reading: storedOf({ version: NATURE_VERSION - 1, nature: "rules" }) },
            { sourceId: "o2", title: "Uniform terms", reading: storedOf({ nature: "rules", entries: "terms", evidence: ["Aprons are hemmed for free"] }) },
        ])
        t.ai.chat.mockResolvedValue(reply(answerOf("reference", "items")))

        const outcome = await t.service.natureFor(source, goods, "c1")

        const prompt = t.ai.chat.mock.calls[0]?.[0].messages[1]?.content ?? ""
        expect(prompt).toContain('EARLIER JUDGEMENTS\n"Uniform terms": rules (entries: terms) - aprons | quotes: "Aprons are hemmed for free"')
        expect(prompt).not.toContain("Old terms")
        expect(outcome).toMatchObject({ kind: "ready", nature: { nature: "rules", by: "model" } })
        expect(t.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, DOC_SOURCE, expect.objectContaining({ nature: "reference", disagreesWith: [{ sourceId: "o2", nature: "rules" }] }))
    })

    it("an answer that contradicts itself is asked once more with the contradiction named; a consistent second answer stands", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValueOnce(reply(answerOf("rules", "items"))).mockResolvedValueOnce(reply(answerOf("reference", "items")))

        await expect(t.service.natureFor(source, goods, "c1")).resolves.toMatchObject({ kind: "ready", calls: 2, nature: { nature: "reference", by: "model" } })

        const second = t.ai.chat.mock.calls[1]?.[0].messages ?? []
        expect(second.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"])
        expect(second[3]?.content).toContain("the document is rules and that most of its entries are items")
        expect(t.usage.record).toHaveBeenCalledWith(expect.objectContaining({ tryNumber: 2 }))
    })

    it("two answers that contradict themselves are no judgement of the whole: every passage is triaged, and nobody is told it disagrees", async () => {
        const t = await build()
        t.extractions.formMates.mockResolvedValue([{ sourceId: "o2", title: "Uniform terms", reading: storedOf({ nature: "rules", entries: "terms" }) }])
        t.ai.chat.mockResolvedValue(reply(answerOf("rules", "items")))

        await expect(t.service.natureFor(source, goods, "c1")).resolves.toMatchObject({ kind: "ready", calls: 2, nature: { nature: "mixed", sections: [], by: "fallback" } })

        expect(t.extractions.saveNature).toHaveBeenCalledTimes(1)
        expect(t.extractions.saveNature).toHaveBeenCalledWith(DOC_WS, DOC_SOURCE, expect.objectContaining({ nature: "mixed", by: "fallback", entries: "items", disagreesWith: [] }))
    })
})
