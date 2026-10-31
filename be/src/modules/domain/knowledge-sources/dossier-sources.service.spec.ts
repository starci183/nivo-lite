import { Test } from "@nestjs/testing"
import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ArrayContains, In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DossierSourcesService } from "./dossier-sources.service"
import { KnowledgeSourceEntity } from "./persistence/entities"

const WS = row.workspaceId

const COLUMNS = {
    id: true,
    title: true,
    topic: true,
    tags: true,
    origin: true,
    kind: true,
    status: true,
    chunkCount: true,
    sizeBytes: true,
    updatedAt: true,
    createdAt: true,
}

const VIEW = {
    id: "s1",
    title: "02. Charter",
    topic: "LEGAL FILES",
    tags: ["dossier:2"],
    origin: "folder",
    kind: "text",
    status: "queued",
    chunkCount: 3,
    sizeBytes: 120,
    updatedAt: "2026-10-12T10:00:00.000Z",
    createdAt: "2026-10-12T10:00:00.000Z",
}

const stored = {
    ...row,
    title: "02. Charter",
    topic: "LEGAL FILES",
    tags: ["dossier:2"],
    origin: "folder",
    chunkCount: 3,
    sizeBytes: 120,
}

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DossierSourcesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(DossierSourcesService)
}

describe("DossierSourcesService sourcesOfTopics", () => {
    it("reads the documents of the categories, oldest first, within the read bound", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [stored]] })
        const service = await build(em)

        await expect(service.sourcesOfTopics(WS, ["LEGAL FILES"], 5000)).resolves.toEqual([VIEW])
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId: WS, topic: In(["LEGAL FILES"]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: 2000,
        })
    })

    it("reads nothing without a category", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.sourcesOfTopics(WS, [], 10)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("DossierSourcesService byTag and sourceOf", () => {
    it("answers the first document carrying a tag, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [KnowledgeSourceEntity, stored],
                [KnowledgeSourceEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.byTag(WS, "remedy:abc")).resolves.toEqual(VIEW)
        await expect(service.byTag(WS, "remedy:none")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenNthCalledWith(1, KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId: WS, tags: ArrayContains(["remedy:abc"]) },
            order: { createdAt: "ASC" },
        })
    })

    it("answers one document of the workspace, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [KnowledgeSourceEntity, stored],
                [KnowledgeSourceEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.sourceOf(WS, "s1")).resolves.toEqual(VIEW)
        await expect(service.sourceOf(WS, "s9")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenNthCalledWith(1, KnowledgeSourceEntity, {
            select: COLUMNS,
            where: { workspaceId: WS, id: "s1" },
        })
    })
})
