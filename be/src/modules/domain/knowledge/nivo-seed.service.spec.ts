import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import type { NivoItemInput } from "@modules/domain/nivo-knowledge"
import { EmbeddingService } from "./embedding.service"
import { NivoSeedService } from "./nivo-seed.service"

const item = (slug: string): NivoItemInput => ({
    module: "core",
    slug,
    title: `T ${slug}`,
    body: `B ${slug}`,
    kind: "playbook",
})

const build = async () => {
    const nivo = mock<NivoKnowledgeService>()
    const embeddings = mock<EmbeddingService>()
    nivo.upsert.mockResolvedValue({ inserted: 1, updated: 1 })
    nivo.removeExcept.mockResolvedValue(1)
    nivo.unembedded.mockResolvedValue([])
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoSeedService,
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: EmbeddingService, useValue: embeddings },
        ],
    }).compile()
    return { service: moduleRef.get(NivoSeedService), nivo, embeddings }
}

describe("NivoSeedService", () => {
    it("writes the items, removes the ones no longer given and embeds the ones without a vector, unmetered", async () => {
        const { service, nivo, embeddings } = await build()
        nivo.unembedded
            .mockResolvedValueOnce([
                { id: "n1", text: "T a\n\nB a" },
                { id: "n2", text: "T b\n\nB b" },
            ])
            .mockResolvedValueOnce([])
        embeddings.embed.mockResolvedValue([[1], [2]])

        await expect(service.seed([item("a"), item("b")])).resolves.toEqual({
            inserted: 1,
            updated: 1,
            removed: 1,
            embedded: 2,
        })

        expect(nivo.removeExcept).toHaveBeenCalledWith(["a", "b"])
        expect(nivo.unembedded).toHaveBeenCalledWith("m1", 32)
        expect(embeddings.embed).toHaveBeenCalledWith({
            workspaceId: null,
            texts: ["T a\n\nB a", "T b\n\nB b"],
            timeoutMs: 30_000,
        })
        expect(nivo.setVectors).toHaveBeenCalledWith({ model: "m1", ids: ["n1", "n2"], vectors: ["[1]", "[2]"] })
    })

    it("leaves the items searchable by words when embeddings are not configured", async () => {
        const { service, embeddings } = await build()
        embeddings.configured.mockReturnValue(false)

        await expect(service.seed([item("a")])).resolves.toMatchObject({ embedded: 0 })

        expect(embeddings.embed).not.toHaveBeenCalled()
    })

    it("leaves the items searchable by words when the provider fails", async () => {
        const { service, nivo, embeddings } = await build()
        nivo.unembedded.mockResolvedValue([{ id: "n1", text: "T" }])
        embeddings.embed.mockResolvedValue(null)

        await expect(service.seed([item("a")])).resolves.toMatchObject({ embedded: 0 })

        expect(nivo.setVectors).not.toHaveBeenCalled()
    })

    it("stores an empty vector for an item the provider answered nothing for", async () => {
        const { service, nivo, embeddings } = await build()
        nivo.unembedded.mockResolvedValueOnce([{ id: "n1", text: "T" }]).mockResolvedValueOnce([])
        embeddings.embed.mockResolvedValue([])

        await service.seed([item("a")])

        expect(nivo.setVectors).toHaveBeenCalledWith({ model: "m1", ids: ["n1"], vectors: ["[]"] })
    })

    it("stops after the most batches one run embeds", async () => {
        const { service, nivo, embeddings } = await build()
        nivo.unembedded.mockResolvedValue([{ id: "n1", text: "T" }])
        embeddings.embed.mockResolvedValue([[1]])

        await expect(service.seed([item("a")])).resolves.toMatchObject({ embedded: 50 })
    })
})
