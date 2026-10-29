import { EMBEDDING_DIMENSIONS, toVector } from "@modules/domain/knowledge-chunks"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoSeedService } from "./nivo-seed.service"

const TONE = { path: "core/core-tone.md", text: "---\ntitle: Tone\nkind: tone\n---\nWarm and short." }
const PLAYBOOK = { path: "chatbot/chatbot-care.md", text: "---\ntitle: Care\nkind: playbook\n---\nAnswer fast." }

const build = async () => {
    const pool = mock<AiService>()
    pool.available.mockReturnValue(true)
    pool.embeddingModel.mockReturnValue("embed-1")
    const nivo = mock<NivoKnowledgeService>()
    nivo.upsert.mockResolvedValue({ inserted: 1, updated: 1 })
    nivo.removeExcept.mockResolvedValue(3)
    nivo.unembedded.mockResolvedValue([])
    const folder = mock<NivoFolderClient>()
    folder.read.mockResolvedValue([TONE, PLAYBOOK])
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoSeedService,
            { provide: NIVO_KNOWLEDGE_OPTIONS, useValue: { folders: ["core", "chatbot"] } },
            { provide: AI, useValue: pool },
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: NivoFolderClient, useValue: folder },
        ],
    }).compile()
    return { service: moduleRef.get(NivoSeedService), pool, nivo, folder }
}

/** A vector of the stored size. */
const vectorOf = (value: number): Array<number> => Array.from({ length: EMBEDDING_DIMENSIONS }, () => value)

describe("NivoSeedService", () => {
    it("publishes the shipped files and removes the items no file gives any more", async () => {
        const { service, nivo, folder } = await build()

        await expect(service.seedFolder(undefined)).resolves.toEqual({
            inserted: 1,
            updated: 1,
            removed: 3,
            embedded: 0,
        })
        expect(folder.read).toHaveBeenCalledWith(undefined)
        expect(nivo.upsert).toHaveBeenCalledWith([
            { module: "core", slug: "core-tone", title: "Tone", kind: "tone", body: "Warm and short." },
            { module: "chatbot", slug: "chatbot-care", title: "Care", kind: "playbook", body: "Answer fast." },
        ])
        expect(nivo.removeExcept).toHaveBeenCalledWith(["core-tone", "chatbot-care"])
    })

    it("embeds the items without a vector, batch after batch, until none is left", async () => {
        const { service, pool, nivo, folder } = await build()
        nivo.unembedded
            .mockResolvedValueOnce([
                { id: "n1", text: "Tone" },
                { id: "n2", text: "Care" },
            ])
            .mockResolvedValueOnce([])
        pool.embed.mockResolvedValue({
            vectors: [vectorOf(0.5), vectorOf(1)],
            usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
        })

        await expect(service.seedFolder("/other")).resolves.toMatchObject({ embedded: 2 })
        expect(folder.read).toHaveBeenCalledWith("/other")
        expect(nivo.setVectors).toHaveBeenCalledWith({
            model: "embed-1",
            ids: ["n1", "n2"],
            vectors: [toVector(vectorOf(0.5)), toVector(vectorOf(1))],
        })
    })

    it("embeds nothing without a key, and stops when the provider fails or answers vectors of another size", async () => {
        const unkeyed = await build()
        unkeyed.pool.available.mockReturnValue(false)
        const failing = await build()
        failing.nivo.unembedded.mockResolvedValue([{ id: "n1", text: "Tone" }])
        failing.pool.embed.mockResolvedValue(null)
        const sized = await build()
        sized.nivo.unembedded.mockResolvedValue([{ id: "n1", text: "Tone" }])
        sized.pool.embed.mockResolvedValue({
            vectors: [[0.5]],
            usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
        })

        await expect(unkeyed.service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 0 })
        await expect(failing.service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 0 })
        await expect(sized.service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 0 })
        expect(failing.nivo.setVectors).not.toHaveBeenCalled()
        expect(sized.nivo.setVectors).not.toHaveBeenCalled()
    })

    it("refuses two files with one slug before writing anything", async () => {
        const { service, nivo, folder } = await build()
        folder.read.mockResolvedValue([TONE, { ...TONE, path: "chatbot/core-tone.md" }])

        await expect(service.seedFolder(undefined)).rejects.toMatchObject({
            code: NivoKnowledgeErrorCode.SlugDuplicate,
            params: { file: "chatbot/core-tone.md" },
        })
        expect(nivo.upsert).not.toHaveBeenCalled()
    })

    it("refuses a file without front matter", async () => {
        const { service, folder } = await build()
        folder.read.mockResolvedValue([{ path: "core/plain.md", text: "No header" }])

        await expect(service.seedFolder(undefined)).rejects.toMatchObject({
            code: NivoKnowledgeErrorCode.FrontMatterMissing,
        })
    })
})
