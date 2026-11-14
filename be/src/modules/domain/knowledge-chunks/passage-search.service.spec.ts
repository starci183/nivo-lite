import { Test } from "@nestjs/testing"
import { Brackets } from "typeorm"
import type { WhereExpressionBuilder } from "typeorm"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { GIO_MO_CUA_VI, PHI_SHIP_35_000D_SP_0123_VI, PHI_SHIP_NOI_THANH_20_000D_VI } from "@tests/fixtures/i18n/knowledge-chunks-spec.messages"
import type { PassageLens } from "./passage-search.contracts"
import { PassageSearchService } from "./passage-search.service"

const WS = "11111111-1111-4111-8111-111111111111"
const internal: PassageLens = { workspaceId: WS, module: "chatbot", audience: "internal", installationId: "i1" }
const customer: PassageLens = { ...internal, audience: "customer" }

const ALL = "websearch_to_tsquery('simple', public.knowledge_fold(:words))"
const ANY = `CAST(replace(CAST(${ALL} AS text), ' & ', ' | ') AS tsquery)`

const raw = (id: string, extra: Readonly<Record<string, unknown>> = {}) => ({
    id,
    sourceId: "s1",
    module: null,
    ord: 3,
    content: PHI_SHIP_NOI_THANH_20_000D_VI,
    visibility: "public",
    customerReady: true,
    placeKind: "page",
    placeLabel: "2",
    ...extra,
})

const stored = (id: string) => ({
    id,
    sourceId: "s1",
    module: null,
    order: 3,
    content: PHI_SHIP_NOI_THANH_20_000D_VI,
    visibility: "public",
    customerReady: true,
    place: { kind: "page", label: "2" },
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [PassageSearchService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(PassageSearchService)
}

/** The conditions a statement carries, the bracketed ones opened. */
const conditionsOf = (fake: FakeQueryBuilder | undefined): ReadonlyArray<ReadonlyArray<unknown>> => {
    const opened: Array<ReadonlyArray<unknown>> = []
    const scope = mock<WhereExpressionBuilder>()
    scope.where.mockImplementation((...args: Array<unknown>) => (opened.push(args), scope))
    scope.orWhere.mockImplementation((...args: Array<unknown>) => (opened.push(args), scope))
    for (const args of [...(fake?.callsOf("where") ?? []), ...(fake?.callsOf("andWhere") ?? [])]) {
        const [first] = args
        if (first instanceof Brackets) first.whereFactory(scope)
        else opened.push(args)
    }
    return opened
}

/** The lens every statement carries, as its conditions. */
const LENS = [
    ["c.workspaceId = :workspaceId", { workspaceId: WS }],
    ["c.module IS NULL"],
    ["c.module = :module", { module: "chatbot" }],
    ["c.installationId IS NULL"],
    ["c.installationId = :installationId", { installationId: "i1" }],
]

/** What a customer audience adds to every statement: public passages the trust gate released. */
const SERVED = [["c.visibility = :served", { served: "public" }], ["c.customer_ready = true"]]

describe("PassageSearchService", () => {
    describe("byWords", () => {
        it("finds by the words the database folds and parses itself, every word required, in the lens, bounded", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [raw("b", { rank: "0.2" }), raw("a", { rank: 0.2 }), raw("c", { rank: 0.9 })] }])
            const service = await build(em)

            const hits = await service.byWords(internal, { words: PHI_SHIP_35_000D_SP_0123_VI, limit: 400 })

            // One order whatever the database answered on a tie: rank, then the id.
            expect(hits.map((hit) => [hit.id, hit.rank])).toEqual([["c", 0.9], ["a", 0.2], ["b", 0.2]])
            expect(hits[0]).toEqual({ ...stored("c"), rank: 0.9, complete: true })
            expect(conditionsOf(fake)).toEqual([...LENS, [`c.fts @@ ${ALL}`]])
            // The words go to the database as written: it folds diacritics and cuts numbers and codes as it did for the index.
            expect(fake?.callsOf("setParameters")).toEqual([[{ words: PHI_SHIP_35_000D_SP_0123_VI }]])
            expect(fake?.callsOf("addSelect")).toContainEqual([`ts_rank_cd(c.fts, ${ALL})`, "rank"])
            expect(fake?.callsOf("orderBy")).toEqual([["rank", "DESC"]])
            expect(fake?.callsOf("limit")).toEqual([[40]])
        })

        it("lets one word be enough when asked", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

            await (await build(em)).byWords(internal, { words: GIO_MO_CUA_VI, match: "any", limit: 5 })

            expect(conditionsOf(fake)).toContainEqual([`c.fts @@ ${ANY}`])
            expect(fake?.callsOf("limit")).toEqual([[5]])
        })

        it("serves a customer audience public passages the trust gate released, in the statement", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

            await (await build(em)).byWords(customer, { words: "ship", limit: 5 })

            expect(conditionsOf(fake)).toEqual([...LENS, ...SERVED, [`c.fts @@ ${ALL}`]])
        })

        it("runs nothing for blank words", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).byWords(internal, { words: "  ", limit: 5 })).resolves.toEqual([])

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})

describe("PassageSearchService reads by place", () => {
    describe("byIds", () => {
        it("reads back the rows of these ids inside the lens only: an id the lens does not serve is not answered", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [raw("p1")] }])
            const service = await build(em)

            await expect(service.byIds(customer, ["p1", "withheld", "p1"])).resolves.toEqual([stored("p1")])
            await expect(service.byIds(customer, [])).resolves.toEqual([])

            expect(conditionsOf(fake)).toEqual([...LENS, ...SERVED, ["c.id IN (:...passageIds)", { passageIds: ["p1", "withheld"] }]])
            expect(fake?.callsOf("limit")).toEqual([[2]])
            expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        })
    })

    describe("one", () => {
        it("reads one passage inside the lens, or null", async () => {
            const em = mockEntityManager()
            const [found, missing] = queueQueryBuilders(em, [{ getRawOne: raw("p1") }, { getRawOne: undefined }])
            const service = await build(em)

            await expect(service.one(internal, "p1")).resolves.toEqual(stored("p1"))
            await expect(service.one(customer, "p2")).resolves.toBeNull()

            expect(conditionsOf(found)).toEqual([...LENS, ["c.id = :passageId", { passageId: "p1" }]])
            // A passage withheld from customers is not found by its id either.
            expect(conditionsOf(missing)).toEqual([...LENS, ...SERVED, ["c.id = :passageId", { passageId: "p2" }]])
        })
    })

    describe("stretch", () => {
        it("reads forward from a position by keyset, bounded", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [raw("p3"), raw("p4", { ord: 4 })] }])

            const passages = await (await build(em)).stretch(internal, { sourceId: "s1", from: 3, direction: "forward", limit: 99 })

            expect(passages.map((passage) => passage.order)).toEqual([3, 4])
            expect(conditionsOf(fake)).toEqual([
                ...LENS,
                ["c.sourceId = :sourceId", { sourceId: "s1" }],
                ["c.ord >= :from", { from: 3 }],
            ])
            expect(fake?.callsOf("orderBy")).toEqual([["c.ord", "ASC"]])
            expect(fake?.callsOf("limit")).toEqual([[12]])
        })

        it("reads backward before a position, and a customer audience steps over what it is not served", async () => {
            const em = mockEntityManager()
            const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

            await (await build(em)).stretch(customer, { sourceId: "s1", from: 3, direction: "backward", limit: 2 })

            expect(conditionsOf(fake)).toEqual([
                ...LENS,
                ...SERVED,
                ["c.sourceId = :sourceId", { sourceId: "s1" }],
                ["c.ord < :from", { from: 3 }],
            ])
            expect(fake?.callsOf("orderBy")).toEqual([["c.ord", "DESC"]])
            expect(fake?.callsOf("limit")).toEqual([[2]])
        })
    })
})

describe("PassageSearchService ranked words", () => {
    it("ranks by the terms a passage holds when asked: a naming code or two words make a candidate, every term bound", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    raw("partial", { rank: "3.2", coverage: "3" }),
                    raw("whole", { rank: 4.4, coverage: 4 }),
                ],
            },
        ])

        const hits = await (await build(em)).byWords(internal, { words: "SP-0015 cao", match: "ranked", limit: 6 })

        const term = (param: string) => `phraseto_tsquery('simple', public.knowledge_fold(:${param}))`
        const coverage = `(CASE WHEN c.fts @@ ${term("wt0")} THEN 3 ELSE 0 END + CASE WHEN c.fts @@ ${term("wt1")} THEN 1 ELSE 0 END)`
        // The naming code alone makes a candidate; the other word only ranks.
        expect(conditionsOf(fake)).toEqual([...LENS, [`c.fts @@ ((${term("wt0")}))`]])
        expect(fake?.callsOf("setParameters")).toEqual([[{ wt0: "SP-0015", wt1: "cao" }]])
        expect(fake?.callsOf("addSelect")).toContainEqual([coverage, "coverage"])
        expect(fake?.callsOf("addSelect")).toContainEqual([
            `2 * ${coverage} + CASE WHEN c.triage = 'rule' THEN 1 ELSE 0 END + 0.5 * ts_rank_cd(c.fts, ${term("wt0")} && ${term("wt1")}, 32) + 0.4 * ts_rank(c.fts, ${term("wt0")} || ${term("wt1")}, 32)`,
            "rank",
        ])
        expect(fake?.callsOf("orderBy")).toEqual([["rank", "DESC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([["c.id", "ASC"]])
        // A passage holding the code and "cao" holds every term (4 of 4): the fusion counts it first.
        expect(hits.map((hit) => [hit.id, hit.complete])).toEqual([
            ["whole", true],
            ["partial", false],
        ])
    })

    it("asks two words to stand side by side, with the query's phrases and without its excluded words", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])

        await (await build(em)).byWords(customer, { words: 'calla lily "tham mep" -tulip', match: "ranked", limit: 6 })

        const term = (param: string) => `phraseto_tsquery('simple', public.knowledge_fold(:${param}))`
        expect(conditionsOf(fake)).toEqual([
            ...LENS,
            ...SERVED,
            [
                `c.fts @@ ((tsquery_phrase(${term("wt0")}, ${term("wt1")})) || ${term("wp0")}) AND c.fts @@ ${term("wp0")} AND NOT (c.fts @@ ${term("wx0")})`,
            ],
        ])
        expect(fake?.callsOf("setParameters")).toEqual([[{ wt0: "calla", wt1: "lily", wp0: "tham mep", wx0: "tulip" }]])
    })

    it("runs nothing for a ranked query with nothing to search by", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).byWords(internal, { words: "-tulip", match: "ranked", limit: 6 })).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
