import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LLM } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { NivoKnowledgeError } from "./errors/nivo-knowledge.error"
import { NivoFolderClient } from "./nivo-folder.client"
import type { NivoFile } from "./nivo-item.policy"
import { NIVO_KNOWLEDGE_OPTIONS } from "./nivo-knowledge.decorators"
import { NivoKnowledgeService } from "./nivo-knowledge.service"
import { NivoSeedService } from "./nivo-seed.service"

const file = (path: string): NivoFile => ({ path, text: "---\ntitle: Tone\nkind: tone\n---\nBody" })

const build = async (files: ReadonlyArray<NivoFile>, embeddings: boolean) => {
    const llm = mock<LlmPort>()
    llm.embeddingsConfigured.mockReturnValue(embeddings)
    llm.embeddingModel.mockReturnValue("embed-model")
    const nivo = mock<NivoKnowledgeService>()
    nivo.upsert.mockResolvedValue({ inserted: 1, updated: 0 })
    nivo.removeExcept.mockResolvedValue(2)
    const folder = mock<NivoFolderClient>()
    folder.read.mockResolvedValue(files)
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoSeedService,
            { provide: NIVO_KNOWLEDGE_OPTIONS, useValue: { folders: ["core"] } },
            { provide: LLM, useValue: llm },
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: NivoFolderClient, useValue: folder },
        ],
    }).compile()
    return { service: moduleRef.get(NivoSeedService), llm, nivo, folder }
}

describe("NivoSeedService", () => {
    it("publishes the shipped knowledge when no folder is named and keeps only its slugs", async () => {
        const { service, nivo, folder } = await build([file("core/core-tone.md")], false)

        await expect(service.seedFolder(undefined)).resolves.toEqual({
            inserted: 1,
            updated: 0,
            removed: 2,
            embedded: 0,
        })

        expect(folder.read).toHaveBeenCalledWith(undefined)
        expect(nivo.upsert).toHaveBeenCalledWith([
            { module: "core", slug: "core-tone", title: "Tone", kind: "tone", body: "Body" },
        ])
        expect(nivo.removeExcept).toHaveBeenCalledWith(["core-tone"])
    })

    it("refuses two files with one slug before anything is written", async () => {
        const { service, nivo } = await build([file("core/core-tone.md"), file("core/sub/core-tone.md")], false)

        await expect(service.seedFolder("knowledge/custom")).rejects.toBeInstanceOf(NivoKnowledgeError)

        expect(nivo.upsert).not.toHaveBeenCalled()
    })

    it("embeds the items that have no vector of the model in use", async () => {
        const { service, llm, nivo } = await build([file("core/core-tone.md")], true)
        nivo.unembedded.mockResolvedValueOnce([{ id: "n-1", text: "Tone Body" }]).mockResolvedValueOnce([])
        llm.embed.mockResolvedValue({
            vectors: [[0.5]],
            usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1, costUsd: null },
        })

        await expect(service.seedFolder(undefined)).resolves.toMatchObject({ embedded: 1 })

        expect(nivo.setVectors).toHaveBeenCalledWith(expect.objectContaining({ model: "embed-model", ids: ["n-1"] }))
    })
})
