import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LLM } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoSeedService } from "./nivo-seed.service"

const TONE = { path: "core/core-tone.md", text: "---\ntitle: Tone\nkind: tone\n---\nWarm and short." }
const PLAYBOOK = { path: "chatbot/chatbot-care.md", text: "---\ntitle: Care\nkind: playbook\n---\nAnswer fast." }

const build = async () => {
    const llm = mock<LlmPort>()
    llm.embeddingsConfigured.mockReturnValue(true)
    llm.embeddingModel.mockReturnValue("embed-1")
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
            { provide: LLM, useValue: llm },
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: NivoFolderClient, useValue: folder },
        ],
    }).compile()
    return { service: moduleRef.get(NivoSeedService), llm, nivo, folder }
}

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
        const { service, llm, nivo, folder } = await build()
        nivo.unembedded
            .mockResolvedValueOnce([
                { id: "n1", text: "Tone" },
                { id: "n2", text: "Care" },
            ])
            .mockResolvedValueOnce([])
        llm.embed.mockResolvedValue({
            vectors: [[0.5, 1]],
            usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
        })

        await expect(service.seedFolder("/other")).resolves.toMatchObject({ embedded: 2 })
        expect(folder.read).toHaveBeenCalledWith("/other")
        expect(nivo.setVectors).toHaveBeenCalledWith({
            model: "embed-1",
            ids: ["n1", "n2"],
            vectors: ["[0.5,1]", "[]"],
        })
    })

    it("embeds nothing without an embeddings key, and stops when the provider fails", async () => {
        const unkeyed = await build()
        unkeyed.llm.embeddingsConfigured.mockReturnValue(false)
        const failing = await build()
        failing.nivo.unembedded.mockResolvedValue([{ id: "n1", text: "Tone" }])
        failing.llm.embed.mockResolvedValue(null)

        await expect(unkeyed.service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 0 })
        await expect(failing.service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 0 })
        expect(failing.nivo.setVectors).not.toHaveBeenCalled()
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
