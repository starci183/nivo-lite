import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DONG_VI, SHIPPING_FEE_QUERY_VI, TAX_ID_QUESTION_VI } from "@tests/fixtures/i18n/brain-facts-spec.messages"
import {
    BrainFactsReadService,
    FACT_WORDS_SQL,
    FACT_WORDS_STATUSES_SQL,
    WORD_HITS_MAX,
} from "./brain-facts-read.service"
import { factSlugOf } from "./fact-key.policy"
import type { FactRecord } from "./brain-facts.contracts"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsReadService)
}

/** The words of a row as the database folds them (FACT_WORDS_SQL), mirrored for the spec's fake database. */
const wordsOfRow = (row: Pick<FactRecord, "subjectKey" | "attribute" | "value">): ReadonlySet<string> =>
    new Set(factSlugOf(`${row.subjectKey} ${row.attribute} ${row.value}`).split("-"))

/** A workspace of `size` facts in force, newest first; the OLDEST is the tax code, asked by its words alone. */
const workspaceOf = (size: number) => {
    const rows = Array.from({ length: size }, (_, index) =>
        facts.rowOf({
            id: `p-${String(index)}`,
            status: "active",
            subjectKey: `san-pham-${String(index)}`,
            attribute: "gia-ban",
            value: `${String(10 + index)}.000 ${DONG_VI}`,
            updatedAt: new Date(Date.parse(facts.AT) - index * 60_000),
        }),
    )
    rows[size - 1] = facts.rowOf({
        id: "tax",
        status: "active",
        subjectKey: "cong-ty",
        attribute: "ma-so-thue",
        value: "0312345678",
        updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    })
    const em = mockEntityManager()
    em.find.mockImplementation((_entity, options) => Promise.resolve(rows.slice(0, options?.take)))
    const [words] = queueQueryBuilders(em, [
        {
            getMany: () => {
                const asked = ["ma", "so", "thue", "cua", "tiem"]
                return rows.filter((row) => asked.some((word) => wordsOfRow(row).has(word))).slice(0, WORD_HITS_MAX)
            },
        },
    ])
    return { em, words }
}

describe("Owner order 2026-11-11 item 6: word search reaches every fact of the view, not the newest 500", () => {
    it.each([500, 5000])(
        "with %i facts in force the oldest fact is found by its words, in two reads whatever the size",
        async (size) => {
            const { em, words } = workspaceOf(size)
            const service = await build(em)

            const found = await service.search(facts.WS, "internal", "accounting", null, TAX_ID_QUESTION_VI, 3)

            expect(found.map((fact) => fact.id)).toEqual(["tax"])
            // One window read and one word read, at 500 as at 5,000: the count does not grow with the graph.
            expect(em.find).toHaveBeenCalledTimes(1)
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
            const [condition, parameters] = words?.callsOf("where")[0] ?? []
            expect(condition).toBe(
                `f.workspaceId = :workspaceId AND ${FACT_WORDS_STATUSES_SQL} AND ${FACT_WORDS_SQL} @@ to_tsquery('simple'::regconfig, :words)`,
            )
            // Accents folded on both sides: the tax-number question asks the words the index holds for "ma-so-thue".
            expect(parameters).toEqual({ workspaceId: facts.WS, words: "ma | so | thue | cua | tiem" })
            expect(words?.callsOf("limit")).toEqual([[WORD_HITS_MAX]])
        },
    )
})

describe("Owner order 2026-11-11 item 6: the word search asks the same view as the vector search", () => {
    it("asks the lens in SQL like the vector search: a customer view reads public facts, an instance its own and the shop's", async () => {
        const em = mockEntityManager()
        const [customer, instance] = queueQueryBuilders(em, [{ getMany: [] }, { getMany: [] }])
        const service = await build(em)

        await service.wordHits(facts.WS, "customer", "chatbot", null, SHIPPING_FEE_QUERY_VI)
        await service.wordHits(facts.WS, "internal", "sales", "inst-1", SHIPPING_FEE_QUERY_VI)

        expect(customer?.callsOf("andWhere")).toEqual([
            ["f.installationId IS NULL", { installationId: null }],
            ["f.scope = 'public'", { module: "chatbot" }],
        ])
        expect(instance?.callsOf("andWhere")).toEqual([
            ["(f.installationId IS NULL OR f.installationId = :installationId)", { installationId: "inst-1" }],
            ["(f.scope <> 'restricted' OR :module = ANY(f.modules))", { module: "sales" }],
        ])
    })

    it("reads nothing for a question with no word of two letters", async () => {
        const em = mockEntityManager()
        await expect((await build(em)).wordHits(facts.WS, "internal", "sales", null, "? a !")).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("asks exactly the expression migration 20261112015200 indexes, on the same statuses", () => {
        // The index of db/migrations/20261112015200_brain-facts-words.sql, copied verbatim: the planner uses it only for this text.
        const indexed =
            "to_tsvector('simple'::regconfig, regexp_replace(public.knowledge_fold(subject_key || ' ' || attribute || ' ' || value), '[^a-z0-9]+', ' ', 'g'))"

        expect(FACT_WORDS_SQL.replaceAll("f.", "")).toBe(indexed)
        expect(FACT_WORDS_STATUSES_SQL).toBe("f.status IN ('active', 'scheduled')")
    })
})

describe("BrainFactsReadService.kinOf: the other values of the served truths, one bounded read", () => {
    it("reads the facts of the keys in force, scheduled or waiting, and the proposals naming a served fact", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [facts.rowOf({ id: "p2" })] }])
        const service = await build(em)

        await expect(
            service.kinOf(facts.WS, { keys: [{ subjectKey: "giao-hang", attribute: "phi" }], ids: ["f1"] }),
        ).resolves.toMatchObject([{ id: "p2" }])

        expect(read?.callsOf("where")).toEqual([
            [
                "f.workspaceId = :workspaceId AND f.status IN ('active', 'scheduled', 'proposed') AND ((f.subjectKey = :s0 AND f.attribute = :a0) OR (f.status = 'proposed' AND f.conflictWith IN (:...ids)))",
                { workspaceId: facts.WS, s0: "giao-hang", a0: "phi", ids: ["f1"] },
            ],
        ])
        expect(read?.callsOf("limit")).toEqual([[200]])
    })

    it("reads nothing for nothing served", async () => {
        const em = mockEntityManager()
        await expect((await build(em)).kinOf(facts.WS, { keys: [], ids: [] })).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
