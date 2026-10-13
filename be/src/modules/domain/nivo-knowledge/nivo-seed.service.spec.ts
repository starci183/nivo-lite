import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LLM, type LlmPort, type LlmUsage } from "@modules/integrations/llm"
import { NivoKnowledgeError, NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import type { NivoFile } from "./nivo-item.policy"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoSeedService } from "./nivo-seed.service"

const OPTIONS = { folders: ["core", "video"], dir: "/opt/nivo-knowledge" }

const USAGE: LlmUsage = { promptTokens: 3, completionTokens: null, totalTokens: 3, costUsd: null }

const document = (path: string, title: string, kind: string, body: string): NivoFile => ({
    path,
    text: `---\ntitle: ${title}\nkind: ${kind}\n---\n${body}\n`,
})

const TONE = document("video/tone.md", "Tone", "tone", "Be brief")

const build = async () => {
    const llm = mock<LlmPort>()
    const nivo = mock<NivoKnowledgeService>()
    const folder = mock<NivoFolderClient>()
    llm.embeddingsConfigured.mockReturnValue(false)
    llm.embeddingModel.mockReturnValue("embed-model")
    llm.embed.mockResolvedValue(null)
    nivo.upsert.mockResolvedValue({ inserted: 0, updated: 0 })
    nivo.removeExcept.mockResolvedValue(0)
    nivo.unembedded.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoSeedService,
            { provide: NIVO_KNOWLEDGE_OPTIONS, useValue: OPTIONS },
            { provide: LLM, useValue: llm },
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: NivoFolderClient, useValue: folder },
        ],
    }).compile()
    return { service: moduleRef.get(NivoSeedService), llm, nivo, folder }
}

describe("NivoSeedService", () => {
    it("publishes the default folder and embeds the items that have no vector", async () => {
        const { service, llm, nivo, folder } = await build()
        folder.read.mockResolvedValue([TONE, document("core/playbook.md", "Playbook", "playbook", "How to work")])
        nivo.upsert.mockResolvedValue({ inserted: 1, updated: 1 })
        nivo.removeExcept.mockResolvedValue(2)
        llm.embeddingsConfigured.mockReturnValue(true)
        nivo.unembedded.mockResolvedValueOnce([{ id: "item-1", text: "Tone\n\nBe brief" }]).mockResolvedValue([])
        llm.embed.mockResolvedValue({ vectors: [[0.5, 1]], usage: USAGE })

        await expect(service.seedFolder(undefined)).resolves.toEqual({
            inserted: 1,
            updated: 1,
            removed: 2,
            embedded: 1,
        })

        expect(folder.read).toHaveBeenCalledWith("/opt/nivo-knowledge")
        expect(nivo.upsert).toHaveBeenCalledWith([
            { module: "video", slug: "tone", title: "Tone", kind: "tone", body: "Be brief" },
            { module: "core", slug: "playbook", title: "Playbook", kind: "playbook", body: "How to work" },
        ])
        expect(nivo.removeExcept).toHaveBeenCalledWith(["tone", "playbook"])
        expect(nivo.unembedded).toHaveBeenCalledWith("embed-model", 32)
        expect(llm.embed).toHaveBeenCalledWith(["Tone\n\nBe brief"], 30_000)
        expect(nivo.setVectors).toHaveBeenCalledWith({ model: "embed-model", ids: ["item-1"], vectors: ["[0.5,1]"] })
    })

    it("reads the folder it was given", async () => {
        const { service, folder, nivo } = await build()
        folder.read.mockResolvedValue([])

        await expect(service.seedFolder("/custom")).resolves.toEqual({
            inserted: 0,
            updated: 0,
            removed: 0,
            embedded: 0,
        })

        expect(folder.read).toHaveBeenCalledWith("/custom")
        expect(nivo.upsert).toHaveBeenCalledWith([])
        expect(nivo.removeExcept).toHaveBeenCalledWith([])
    })

    it("refuses a file with no front matter before writing", async () => {
        const { service, folder, nivo } = await build()
        folder.read.mockResolvedValue([{ path: "video/bad.md", text: "no front matter" }])

        await expect(service.seedFolder("/custom")).rejects.toBeInstanceOf(NivoKnowledgeError)
        await expect(service.seedFolder("/custom")).rejects.toMatchObject({
            code: NivoKnowledgeErrorCode.FrontMatterMissing,
            params: { file: "video/bad.md" },
        })
        expect(nivo.upsert).not.toHaveBeenCalled()
    })

    it("refuses two files that share a slug before writing", async () => {
        const { service, folder, nivo } = await build()
        folder.read.mockResolvedValue([TONE, document("core/tone.md", "Other", "tone", "Two")])

        await expect(service.seedFolder("/custom")).rejects.toMatchObject({
            code: NivoKnowledgeErrorCode.SlugDuplicate,
            params: { file: "core/tone.md" },
        })
        expect(nivo.upsert).not.toHaveBeenCalled()
    })

    it("leaves items searchable by words when embeddings are not configured", async () => {
        const { service, folder, nivo, llm } = await build()
        folder.read.mockResolvedValue([TONE])

        await expect(service.seedFolder("/custom")).resolves.toEqual({
            inserted: 0,
            updated: 0,
            removed: 0,
            embedded: 0,
        })

        expect(nivo.unembedded).not.toHaveBeenCalled()
        expect(llm.embed).not.toHaveBeenCalled()
    })

    it("stops embedding when the provider returns nothing", async () => {
        const { service, folder, nivo, llm } = await build()
        folder.read.mockResolvedValue([TONE])
        nivo.upsert.mockResolvedValue({ inserted: 1, updated: 0 })
        llm.embeddingsConfigured.mockReturnValue(true)
        nivo.unembedded.mockResolvedValue([{ id: "item-1", text: "Tone\n\nBe brief" }])
        llm.embed.mockResolvedValue(null)

        await expect(service.seedFolder("/custom")).resolves.toEqual({
            inserted: 1,
            updated: 0,
            removed: 0,
            embedded: 0,
        })

        expect(nivo.setVectors).not.toHaveBeenCalled()
    })

    it("writes an empty vector when the provider omits one", async () => {
        const { service, folder, nivo, llm } = await build()
        folder.read.mockResolvedValue([TONE])
        llm.embeddingsConfigured.mockReturnValue(true)
        nivo.unembedded
            .mockResolvedValueOnce([
                { id: "a", text: "A" },
                { id: "b", text: "B" },
            ])
            .mockResolvedValue([])
        llm.embed.mockResolvedValue({ vectors: [[4]], usage: USAGE })

        await expect(service.seedFolder("/custom")).resolves.toEqual({
            inserted: 0,
            updated: 0,
            removed: 0,
            embedded: 2,
        })

        expect(llm.embed).toHaveBeenCalledWith(["A", "B"], 30_000)
        expect(nivo.setVectors).toHaveBeenCalledWith({ model: "embed-model", ids: ["a", "b"], vectors: ["[4]", "[]"] })
    })

    it("embeds at most 50 batches", async () => {
        const { service, folder, nivo, llm } = await build()
        folder.read.mockResolvedValue([])
        llm.embeddingsConfigured.mockReturnValue(true)
        nivo.unembedded.mockResolvedValue([{ id: "item-1", text: "Again" }])
        llm.embed.mockResolvedValue({ vectors: [[1]], usage: USAGE })

        await expect(service.seedFolder("/custom")).resolves.toEqual({
            inserted: 0,
            updated: 0,
            removed: 0,
            embedded: 50,
        })

        expect(nivo.unembedded).toHaveBeenCalledTimes(50)
        expect(nivo.setVectors).toHaveBeenCalledTimes(50)
    })
})
