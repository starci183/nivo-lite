import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import {
    careKnowledgeRow,
    editedKnowledgeRow,
    knowledgeRow,
    knowledgeRowWithText,
    longKnowledgeRow,
} from "@tests/fixtures/builders/nivo-knowledge.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { NivoItemInput } from "./nivo-knowledge.contracts"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoKnowledgeItemEntity } from "./persistence/entities"

/** Runs a value that a spec captured as a function, answering what it returns. */
const called = (value: unknown): unknown =>
    typeof value === "function" ? Reflect.apply(value, undefined, []) : undefined

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const item = (slug: string): NivoItemInput => ({
    module: "core",
    slug,
    title: `T ${slug}`,
    body: `B ${slug}`,
    kind: "playbook",
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [NivoKnowledgeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(NivoKnowledgeService)
}

describe("NivoKnowledgeService", () => {
    describe("upsert", () => {
        it("writes the new items in one transaction and republishes the ones that exist", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOne: [NivoKnowledgeItemEntity, knowledgeRowWithText("T b", "B b")],
                    update: [NivoKnowledgeItemEntity, {}],
                }),
            )
            const [first] = queueQueryBuilders(tx.em, [{ execute: { raw: [{ id: "n1" }] } }, { execute: { raw: [] } }])
            const service = await build(tx.em)

            await expect(service.upsert([item("a"), item("b")])).resolves.toEqual({ inserted: 1, updated: 1 })

            expect(tx.em.createQueryBuilder).toHaveBeenCalledWith(NivoKnowledgeItemEntity, "nivo_knowledge")
            expect(first?.callsOf("insert")).toEqual([[]])
            expect(first?.callsOf("values")).toEqual([
                [{ module: "core", slug: "a", title: "T a", body: "B a", kind: "playbook" }],
            ])
            expect(first?.callsOf("orIgnore")).toEqual([[]])
            expect(first?.callsOf("returning")).toEqual([["id"]])
            expect(tx.commits).toBe(1)
        })
    })
})

describe("NivoKnowledgeService upsert of existing items", () => {
    describe("upsert", () => {
        it("keeps the version and the vector of an item whose text did not change", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOne: [NivoKnowledgeItemEntity, knowledgeRowWithText("T a", "B a")],
                    update: [NivoKnowledgeItemEntity, {}],
                }),
            )
            queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const service = await build(tx.em)

            await service.upsert([item("a")])

            expect(tx.em.findOne).toHaveBeenCalledWith(NivoKnowledgeItemEntity, {
                select: { id: true, title: true, body: true },
                where: { slug: "a" },
            })
            const changes: unknown = tx.em.update.mock.calls[0]?.[2]
            expect(changes).toEqual({
                module: "core",
                title: "T a",
                body: "B a",
                kind: "playbook",
            })
        })

        it("takes the next version and drops the vector of an item whose text changed", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOne: [NivoKnowledgeItemEntity, knowledgeRow()],
                    update: [NivoKnowledgeItemEntity, {}],
                }),
            )
            queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const service = await build(tx.em)

            await service.upsert([item("a")])

            const changes: unknown = tx.em.update.mock.calls[0]?.[2]
            expect(called(isRecord(changes) ? changes.version : undefined)).toBe('"version" + 1')
            expect(changes).toMatchObject({ embedding: null, embeddingModel: null, title: "T a" })
        })

        it("leaves an item that vanished while it was republished", async () => {
            const tx = fakeTransaction(mockEntityManager({ findOne: [NivoKnowledgeItemEntity, null] }))
            queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const service = await build(tx.em)

            await expect(service.upsert([item("a")])).resolves.toEqual({ inserted: 0, updated: 1 })
            expect(tx.em.update).not.toHaveBeenCalled()
        })
    })
})

describe("NivoKnowledgeService counts", () => {
    describe("countFor", () => {
        it("counts the items of the named modules", async () => {
            const em = mockEntityManager({ count: [NivoKnowledgeItemEntity, 4] })
            const service = await build(em)

            await expect(service.countFor(["chatbot", "core"])).resolves.toBe(4)

            expect(em.count).toHaveBeenCalledWith(NivoKnowledgeItemEntity, {
                where: { module: objectLike({ _value: ["chatbot", "core"] }) },
            })
        })

        it("answers zero when the count comes back empty", async () => {
            const em = mockEntityManager({ count: [NivoKnowledgeItemEntity, 0] })
            const service = await build(em)

            await expect(service.countFor(["core"])).resolves.toBe(0)
        })
    })

    describe("countForModule", () => {
        it.each([
            { module: "chatbot", folders: ["chatbot", "core"] },
            { module: "core", folders: ["core"] },
        ])("counts $module together with shared knowledge only once", async ({ module, folders }) => {
            const em = mockEntityManager({ count: [NivoKnowledgeItemEntity, 7] })
            const service = await build(em)

            await expect(service.countForModule(module)).resolves.toBe(7)

            expect(em.count).toHaveBeenCalledWith(NivoKnowledgeItemEntity, {
                where: { module: objectLike({ _value: folders }) },
            })
            expect(em.count).toHaveBeenCalledTimes(1)
        })
    })
})

describe("NivoKnowledgeService rulesOf", () => {
    it("reads the title and text of the items of the modules and kinds, bounded", async () => {
        const em = mockEntityManager({ find: [NivoKnowledgeItemEntity, [knowledgeRow()]] })

        await expect((await build(em)).rulesOf(["video", "core"], ["tone"], 20)).resolves.toEqual([
            { title: "Voice", body: "Warm." },
        ])

        expect(em.find).toHaveBeenCalledWith(NivoKnowledgeItemEntity, {
            select: { title: true, body: true },
            where: { module: In(["video", "core"]), kind: In(["tone"]) },
            order: { module: "DESC", slug: "ASC" },
            take: 20,
        })
    })
})

describe("NivoKnowledgeService list", () => {
    it("maps every stored field and serializes timestamps as UTC ISO strings", async () => {
        const em = mockEntityManager({
            find: [NivoKnowledgeItemEntity, [editedKnowledgeRow(), careKnowledgeRow()]],
        })
        const service = await build(em)

        await expect(service.list()).resolves.toEqual([
            {
                id: "n1",
                module: "core",
                slug: "voice",
                title: "Voice",
                body: "Warm.",
                kind: "tone",
                version: 2,
                updatedAt: "2026-04-01T03:30:00.000Z",
            },
            {
                id: "n2",
                module: "chatbot",
                slug: "care",
                title: "Care",
                body: "Answer fast.",
                kind: "playbook",
                version: 1,
                updatedAt: "2026-04-02T01:02:03.456Z",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(NivoKnowledgeItemEntity, {
            order: { module: "ASC", kind: "ASC", slug: "ASC" },
            take: 500,
        })
    })

    it("returns an empty list when no items exist", async () => {
        const em = mockEntityManager({ find: [NivoKnowledgeItemEntity, []] })
        const service = await build(em)

        await expect(service.list()).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
    })
})

describe("NivoKnowledgeService", () => {
    describe("removeExcept", () => {
        it("answers how many items went", async () => {
            const em = mockEntityManager()
            const removal = queueQueryBuilders(em, [{ execute: { raw: [{ id: "x" }, { id: "y" }] } }])[0]
            const service = await build(em)

            await expect(service.removeExcept(["a"])).resolves.toBe(2)

            expect(em.createQueryBuilder).toHaveBeenCalledWith(NivoKnowledgeItemEntity, "n")

            expect(removal?.callsOf("delete")).toEqual([[]])
            expect(removal?.callsOf("where")).toEqual([["slug <> ALL(CAST(:slugs AS text[]))", { slugs: ["a"] }]])
        })
    })

    describe("unembedded", () => {
        it("names the items that need a vector with the text to embed, cut at the limit", async () => {
            const em = mockEntityManager()
            const read = queueQueryBuilders(em, [{ getMany: [longKnowledgeRow(9000)] }])[0]
            const service = await build(em)

            const found = await service.unembedded("m1", 32)

            expect(read?.callsOf("where")[0]?.[1]).toEqual({ model: "m1" })
            expect(read?.callsOf("limit")).toEqual([[32]])
            expect(found).toEqual([{ id: "n1", text: `T\n\n${"x".repeat(7997)}` }])
        })
    })

    describe("setVectors", () => {
        it("gives the items their vectors", async () => {
            const em = mockEntityManager()
            const write = queueQueryBuilders(em, [{ execute: {} }])[0]
            const service = await build(em)

            await service.setVectors({ model: "m1", ids: ["n1"], vectors: ["[1]"] })

            expect(em.createQueryBuilder).toHaveBeenCalledWith(NivoKnowledgeItemEntity, "n")

            expect(write?.callsOf("update")).toEqual([[]])
            expect(write?.callsOf("setParameters")).toEqual([[{ ids: ["n1"], vectors: ["[1]"] }]])
            const set: unknown = write?.callsOf("set")[0]?.[0]
            expect(called(isRecord(set) ? set.embedding : undefined)).toEqual(
                expect.stringContaining("unnest(CAST(:ids AS uuid[])"),
            )
        })
    })
})
