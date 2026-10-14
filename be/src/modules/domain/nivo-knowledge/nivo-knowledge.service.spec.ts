import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { NivoItemInput } from "./nivo-knowledge.contracts"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import {
    COUNT_NIVO_FOR_MODULES,
    DELETE_STALE_NIVO_ITEMS,
    LIST_NIVO_ITEMS,
    SELECT_NIVO_UNEMBEDDED,
    UPDATE_NIVO_VECTORS,
    UPSERT_NIVO_ITEM,
} from "./persistence/nivo-knowledge.sql"

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
        it("writes the items in one transaction and counts the new ones", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [UPSERT_NIVO_ITEM, [{ inserted: true }]],
                        [UPSERT_NIVO_ITEM, [{ inserted: false }]],
                    ],
                }),
            )
            const service = await build(tx.em)

            await expect(service.upsert([item("a"), item("b")])).resolves.toEqual({ inserted: 1, updated: 1 })

            expect(tx.em.query).toHaveBeenCalledWith(UPSERT_NIVO_ITEM, ["core", "a", "T a", "B a", "playbook"])
            expect(tx.commits).toBe(1)
        })

        it("counts an upsert that answers no row as an update", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPSERT_NIVO_ITEM, []] }))
            const service = await build(tx.em)

            await expect(service.upsert([item("a")])).resolves.toEqual({ inserted: 0, updated: 1 })
        })
    })

    describe("countFor", () => {
        it("counts the items of the named modules", async () => {
            const em = mockEntityManager({ query: [COUNT_NIVO_FOR_MODULES, [{ count: 4 }]] })
            const service = await build(em)

            await expect(service.countFor(["chatbot", "core"])).resolves.toBe(4)

            expect(em.query).toHaveBeenCalledWith(COUNT_NIVO_FOR_MODULES, [["chatbot", "core"]])
        })

        it("answers zero when the count comes back empty", async () => {
            const em = mockEntityManager({ query: [COUNT_NIVO_FOR_MODULES, []] })
            const service = await build(em)

            await expect(service.countFor(["core"])).resolves.toBe(0)
        })
    })

    describe("countForModule", () => {
        it.each([
            { module: "chatbot", folders: ["chatbot", "core"] },
            { module: "core", folders: ["core"] },
        ])("counts $module together with shared knowledge only once", async ({ module, folders }) => {
            const em = mockEntityManager({ query: [COUNT_NIVO_FOR_MODULES, [{ count: 7 }]] })
            const service = await build(em)

            await expect(service.countForModule(module)).resolves.toBe(7)

            expect(em.query).toHaveBeenCalledWith(COUNT_NIVO_FOR_MODULES, [folders])
            expect(em.query).toHaveBeenCalledTimes(1)
        })
    })

    describe("list", () => {
        it("maps every stored field and serializes string and Date timestamps as UTC ISO strings", async () => {
            const em = mockEntityManager({
                query: [
                    LIST_NIVO_ITEMS,
                    [
                        {
                            id: "n1",
                            module: "core",
                            slug: "voice",
                            title: "Voice",
                            body: "Warm.",
                            kind: "tone",
                            version: 2,
                            updated_at: "2026-04-01T10:30:00+07:00",
                        },
                        {
                            id: "n2",
                            module: "chatbot",
                            slug: "care",
                            title: "Care",
                            body: "Answer fast.",
                            kind: "playbook",
                            version: 1,
                            updated_at: new Date("2026-04-02T01:02:03.456Z"),
                        },
                    ],
                ],
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
            expect(em.query).toHaveBeenCalledWith(LIST_NIVO_ITEMS)
        })

        it("returns an empty list when no items exist", async () => {
            const em = mockEntityManager({ query: [LIST_NIVO_ITEMS, []] })
            const service = await build(em)

            await expect(service.list()).resolves.toEqual([])
            expect(em.query).toHaveBeenCalledWith(LIST_NIVO_ITEMS)
        })
    })

    describe("removeExcept", () => {
        it("answers how many items went", async () => {
            const em = mockEntityManager({ query: [DELETE_STALE_NIVO_ITEMS, [{ id: "x" }, { id: "y" }]] })
            const service = await build(em)

            await expect(service.removeExcept(["a"])).resolves.toBe(2)

            expect(em.query).toHaveBeenCalledWith(DELETE_STALE_NIVO_ITEMS, [["a"]])
        })
    })

    describe("unembedded", () => {
        it("names the items that need a vector with the text to embed, cut at the limit", async () => {
            const em = mockEntityManager({
                query: [SELECT_NIVO_UNEMBEDDED, [{ id: "n1", title: "T", body: "x".repeat(9000) }]],
            })
            const service = await build(em)

            const found = await service.unembedded("m1", 32)

            expect(em.query).toHaveBeenCalledWith(SELECT_NIVO_UNEMBEDDED, ["m1", 32])
            expect(found).toEqual([{ id: "n1", text: `T\n\n${"x".repeat(7997)}` }])
        })
    })

    describe("setVectors", () => {
        it("gives the items their vectors", async () => {
            const em = mockEntityManager({ query: [UPDATE_NIVO_VECTORS, []] })
            const service = await build(em)

            await service.setVectors({ model: "m1", ids: ["n1"], vectors: ["[1]"] })

            expect(em.query).toHaveBeenCalledWith(UPDATE_NIVO_VECTORS, [["n1"], ["[1]"], "m1"])
        })
    })
})
