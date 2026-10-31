import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { fakeQueryBuilder, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { In } from "typeorm"
import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeSourcesReadService } from "./knowledge-sources-read.service"
import { KnowledgeSourceEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) =>
    (
        await Test.createTestingModule({
            providers: [KnowledgeSourcesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
        }).compile()
    ).get(KnowledgeSourcesReadService)

/** A manager whose only query builder answers the given terminals and records the chain. */
const managerAnswering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const [fake = fakeQueryBuilder(answers)] = queueQueryBuilders(em, [answers])
    return { em, fake }
}

/** The conditions that make a document public, indexed and shared by every instance of the module. */
const expectSharedPublic = (fake: ReturnType<typeof fakeQueryBuilder>, em: MockEntityManager) => {
    expect(em.createQueryBuilder).toHaveBeenCalledWith(KnowledgeSourceEntity, "s")
    expect(fake.callsOf("where")).toEqual([
        ["s.workspace_id = :workspaceId AND s.visibility = 'public'", { workspaceId: "ws-1" }],
    ])
    expect(fake.callsOf("andWhere")[0]).toEqual([
        "s.status IN ('ready', 'extracting_facts') AND (s.module IS NULL OR s.module = :module)",
        { module: "video" },
    ])
    expect(fake.callsOf("andWhere")[1]).toEqual(["s.installation_id IS NULL"])
}

describe("KnowledgeSourcesReadService", () => {
    describe("publicTexts", () => {
        it("reads the text of the chosen public documents, oldest first, bounded", async () => {
            const rows = [{ title: "Menu", topic: null, content: "Tea" }]
            const { em, fake } = managerAnswering({ getRawMany: rows })

            await expect((await build(em)).publicTexts("ws-1", "video", ["s1", "s2"], 12)).resolves.toBe(rows)

            expectSharedPublic(fake, em)
            expect(fake.callsOf("andWhere")[2]).toEqual([
                "s.id = ANY(CAST(:sourceIds AS uuid[]))",
                { sourceIds: ["s1", "s2"] },
            ])
            expect(fake.callsOf("orderBy")).toEqual([["s.created_at", "ASC"]])
            expect(fake.callsOf("limit")).toEqual([[12]])
        })

        it("reads nothing when no document is chosen", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).publicTexts("ws-1", "video", [], 12)).resolves.toEqual([])
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })
    })

    describe("allPublicTexts", () => {
        it("reads every shareable document oldest first, bounded", async () => {
            const rows = [{ title: "Menu", topic: null, content: "Tea" }]
            const { em, fake } = managerAnswering({ getRawMany: rows })

            await expect((await build(em)).allPublicTexts("ws-1", "video", 20)).resolves.toBe(rows)

            expectSharedPublic(fake, em)
            expect(fake.callsOf("orderBy")).toEqual([["s.created_at", "ASC"]])
            expect(fake.callsOf("limit")).toEqual([[20]])
        })
    })
})

describe("KnowledgeSourcesReadService excerpts", () => {
    describe("changedPublicSince", () => {
        it("lists the documents changed after an instant, oldest change first, and drops malformed rows", async () => {
            const good = {
                id: "s1",
                title: "Menu",
                topic: null,
                excerpt: "Tea",
                changedAt: "2026-10-01T00:00:00.000000Z",
            }
            const { em, fake } = managerAnswering({ getRawMany: [good, { id: "s2" }, null] })

            await expect(
                (await build(em)).changedPublicSince("ws-1", "video", "2026-09-01T00:00:00Z", 400, 5),
            ).resolves.toEqual([good])

            expectSharedPublic(fake, em)
            expect(fake.callsOf("andWhere")[2]).toEqual([
                "s.updated_at > :since::timestamptz",
                { since: "2026-09-01T00:00:00Z" },
            ])
            expect(fake.callsOf("setParameter")).toEqual([["excerptChars", 400]])
            expect(fake.callsOf("orderBy")).toEqual([["s.updated_at"]])
            expect(fake.callsOf("limit")).toEqual([[5]])
        })
    })

    describe("publicExcerpts", () => {
        it("lists the newest public documents with a short excerpt, bounded", async () => {
            const rows = [{ id: "s1", title: "Menu", topic: "food", excerpt: "Tea" }]
            const { em, fake } = managerAnswering({ getRawMany: rows })

            await expect((await build(em)).publicExcerpts("ws-1", "video", 220, 40)).resolves.toBe(rows)

            expectSharedPublic(fake, em)
            expect(fake.callsOf("addSelect")[2]).toEqual([
                "left(regexp_replace(s.content, '\\s+', ' ', 'g'), CAST(:excerptChars AS integer))",
                "excerpt",
            ])
            expect(fake.callsOf("setParameter")).toEqual([["excerptChars", 220]])
            expect(fake.callsOf("orderBy")).toEqual([["s.created_at", "DESC"]])
            expect(fake.callsOf("limit")).toEqual([[40]])
        })
    })
})

describe("KnowledgeSourcesReadService briefsOf", () => {
    it("answers the kind, title and topic of the sources of the workspace", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [row]] })

        await expect((await build(em)).briefsOf("ws-1", ["s1"])).resolves.toEqual([
            { id: row.id, kind: row.kind, title: row.title, topic: row.topic },
        ])
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, kind: true, title: true, topic: true },
            where: { workspaceId: "ws-1", id: In(["s1"]) },
            take: 1,
        })
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).briefsOf("ws-1", [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("KnowledgeSourcesReadService ofOrigin", () => {
    const stored = { ...row, updatedAt: new Date("2026-10-11T10:00:00.000Z") }

    it("lists the sources of an origin, newest change first, bounded, without their text", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [stored]] })

        await expect((await build(em)).ofOrigin("ws-1", "google_drive", 50)).resolves.toEqual([
            {
                id: row.id,
                title: row.title,
                status: row.status,
                visibility: row.visibility,
                sizeBytes: row.sizeBytes,
                updatedAt: "2026-10-11T10:00:00.000Z",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, title: true, status: true, visibility: true, sizeBytes: true, updatedAt: true },
            where: { workspaceId: "ws-1", origin: "google_drive" },
            order: { updatedAt: "DESC", id: "ASC" },
            take: 50,
        })
    })
})
