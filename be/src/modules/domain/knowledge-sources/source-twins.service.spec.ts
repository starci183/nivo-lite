import { Test } from "@nestjs/testing"
import { IsNull, Like, MoreThan, Not } from "typeorm"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { SourceRecord } from "./knowledge-sources.contracts"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { contentHashOf } from "./source-hash.policy"
import { SourceTwinsService } from "./source-twins.service"

const WS = "11111111-1111-4111-8111-111111111111"
const NEW_SOURCE = builder<SourceRecord>({
    id: "s-new",
    workspaceId: WS,
    module: null,
    installationId: null,
    kind: "file",
    topic: null,
    visibility: "internal",
    title: "Plan.pdf",
    content: "",
    status: "reading",
    storagePath: `${WS}/a/Plan.pdf`,
    sourceUrl: null,
    createdBy: "u1",
    contentHash: null,
    updatedAt: "2026-10-12T10:00:00.000Z",
})
const FRESH = Object.assign(new KnowledgeSourceEntity(), { chunkCount: 0, origin: null })
const candidateOf = (id: string) =>
    Object.assign(new KnowledgeSourceEntity(), { id, title: `Plan ${id}`, origin: null })
const partOf = (title: string, content: string) => Object.assign(new KnowledgeSourceEntity(), { title, content })

/** A matcher for an object holding at least these fields, typed unknown so it nests inside an expected object. */
const matching = (fields: object): unknown => expect.objectContaining(fields)

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SourceTwinsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(SourceTwinsService)
}

describe("SourceTwinsService twinOf", () => {
    it("finds a finished document of the workspace with the same text for the same readers", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, FRESH] })
        em.find.mockResolvedValueOnce([candidateOf("s-old")]).mockResolvedValueOnce([])
        const service = await build(em)

        await expect(service.twinOf(NEW_SOURCE(), { first: "same text", later: [] })).resolves.toEqual({
            id: "s-old",
            title: "Plan s-old",
        })

        const same = {
            workspaceId: WS,
            contentHash: contentHashOf("same text"),
            status: "ready",
            chunkCount: MoreThan(0),
            module: IsNull(),
            installationId: IsNull(),
            visibility: "internal",
            id: Not("s-new"),
        }
        expect(em.find).toHaveBeenNthCalledWith(
            1,
            KnowledgeSourceEntity,
            expect.objectContaining({
                where: [
                    { ...same, origin: IsNull() },
                    { ...same, origin: Not(Like("part:%")) },
                ],
            }),
        )
    })

    it("is a twin of a document cut into parts only when every later part is the same, part by part", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, FRESH] })
        em.find
            .mockResolvedValueOnce([candidateOf("a"), candidateOf("b")])
            .mockResolvedValueOnce([partOf("Plan (2/3)", "two"), partOf("Plan (3/3)", "OLD three")])
            .mockResolvedValueOnce([partOf("Plan (3/3)", "three"), partOf("Plan (2/3)", "two")])
        const service = await build(em)

        await expect(service.twinOf(NEW_SOURCE(), { first: "one", later: ["two", "three"] })).resolves.toEqual({
            id: "b",
            title: "Plan b",
        })
    })
})

describe("SourceTwinsService twinOf scope", () => {
    it("finds no twin when no finished document holds the text, or the parts differ in number", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, FRESH] })
        em.find
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([candidateOf("a")])
            .mockResolvedValueOnce([])
        const service = await build(em)

        await expect(service.twinOf(NEW_SOURCE(), { first: "one", later: [] })).resolves.toBeNull()
        await expect(service.twinOf(NEW_SOURCE(), { first: "one", later: ["two"] })).resolves.toBeNull()
    })

    it("compares only a source that never finished: a document read again, a later part and a source that is gone keep their own work", async () => {
        const reread = Object.assign(new KnowledgeSourceEntity(), { chunkCount: 5, origin: null })
        const later = Object.assign(new KnowledgeSourceEntity(), { chunkCount: 0, origin: "part:s0" })
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, reread] })
        const service = await build(em)

        await expect(service.twinOf(NEW_SOURCE(), { first: "x", later: [] })).resolves.toBeNull()
        em.findOne.mockResolvedValueOnce(later)
        await expect(service.twinOf(NEW_SOURCE(), { first: "x", later: [] })).resolves.toBeNull()
        em.findOne.mockResolvedValueOnce(null)
        await expect(service.twinOf(NEW_SOURCE(), { first: "x", later: [] })).resolves.toBeNull()
        expect(em.find).not.toHaveBeenCalled()
    })

    it("looks for the same readers: a public document is not the twin of an internal one", async () => {
        const em = mockEntityManager({ findOne: [KnowledgeSourceEntity, FRESH] })
        em.find.mockResolvedValue([])
        const service = await build(em)

        await service.twinOf(NEW_SOURCE({ visibility: "public", module: "chatbot", installationId: "i1" }), {
            first: "x",
            later: [],
        })

        const readers = { visibility: "public", module: "chatbot", installationId: "i1" }
        expect(em.find).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            matching({ where: [matching(readers), matching(readers)] }),
        )
    })
})
