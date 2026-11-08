import type { EntityManager } from "typeorm"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import {
    persistKnowledgePlaceChunk,
    persistKnowledgePlaceScene,
    updateKnowledgePlaceChunk,
    type KnowledgePlaceChunk,
    type KnowledgePlaceTuple,
    type KnowledgePlaceIdentity,
} from "../../fixtures/builders/knowledge-chunk-place.builder"
import { outputProofSandbox } from "../../world/output-proof-sandbox.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { useTestWorld } from "../../world/use-test-world"

const [KnowledgeChunkEntity] = knowledgeChunksEntities

interface KnowledgePlaceProof {
    /** Reads the real manager only after the world opens. */
    readonly manager: () => EntityManager
    /** Identifies the actual persisted parent chain. */
    readonly identity: KnowledgePlaceIdentity
    /** Gives every attempted chunk a fresh identity and source order. */
    readonly chunkOf: (place: KnowledgePlaceTuple) => KnowledgePlaceChunk
}
const acceptedPlaceCases = (proof: KnowledgePlaceProof) => {
    it.each([
        ["no place", null, null],
        ["a page", "page", "3"],
        ["a slide", "slide", "12"],
        ["a sheet", "sheet", "Annual totals"],
        ["the one-character boundary", "sheet", "A"],
        ["the 120-character boundary", "sheet", "A".repeat(120)],
        ["120 Unicode characters", "sheet", String.fromCodePoint(0x10400).repeat(120)],
    ])("keeps %s exactly as stored", async (_name, placeKind, placeLabel) => {
        const place: KnowledgePlaceTuple = { placeKind, placeLabel }
        const chunk = proof.chunkOf(place)
        await persistKnowledgePlaceChunk(proof.manager(), proof.identity, chunk)
        expect(
            await proof.manager().findOne(KnowledgeChunkEntity, {
                select: { id: true, placeKind: true, placeLabel: true },
                where: { id: chunk.id, workspaceId: proof.identity.workspaceId },
            }),
        ).toEqual({ id: chunk.id, ...place })
    })
}
const invalidPlaceCases = (proof: KnowledgePlaceProof) => {
    it("rejects a label without a kind and leaves the existing row unchanged", async () => {
        const chunk = proof.chunkOf({ placeKind: null, placeLabel: null })
        await persistKnowledgePlaceChunk(proof.manager(), proof.identity, chunk)
        await expect(
            updateKnowledgePlaceChunk(proof.manager(), proof.identity, chunk.id, { placeKind: null, placeLabel: "3" }),
        ).rejects.toMatchObject({ driverError: { code: "23514", constraint: "knowledge_chunks_place_pair_check" } })
        expect(
            await proof.manager().findOne(KnowledgeChunkEntity, {
                select: { id: true, placeKind: true, placeLabel: true },
                where: { id: chunk.id, workspaceId: proof.identity.workspaceId },
            }),
        ).toEqual({ id: chunk.id, placeKind: null, placeLabel: null })
    })

    it.each([
        ["a kind without a label", "page", null],
        ["an unknown kind", "chapter", "3"],
        ["an empty label", "page", ""],
        ["a 121-character label", "sheet", "A".repeat(121)],
    ])("refuses %s without inserting a row", async (_name, placeKind, placeLabel) => {
        const chunk = proof.chunkOf({ placeKind, placeLabel })
        await expect(persistKnowledgePlaceChunk(proof.manager(), proof.identity, chunk)).rejects.toMatchObject({
            driverError: { code: "23514", constraint: "knowledge_chunks_place_check" },
        })
        expect(
            await proof.manager().findOne(KnowledgeChunkEntity, {
                where: { id: chunk.id, workspaceId: proof.identity.workspaceId },
            }),
        ).toBeNull()
    })
}
const clearedPlaceCase = (proof: KnowledgePlaceProof) => {
    it("lets a located passage return to having no place", async () => {
        const chunk = proof.chunkOf({ placeKind: "page", placeLabel: "3" })
        await persistKnowledgePlaceChunk(proof.manager(), proof.identity, chunk)
        await updateKnowledgePlaceChunk(proof.manager(), proof.identity, chunk.id, {
            placeKind: null,
            placeLabel: null,
        })
        expect(
            await proof.manager().findOne(KnowledgeChunkEntity, {
                select: { id: true, placeKind: true, placeLabel: true },
                where: { id: chunk.id, workspaceId: proof.identity.workspaceId },
            }),
        ).toEqual({ id: chunk.id, placeKind: null, placeLabel: null })
    })
}
describe("Knowledge chunk place (persisted local constraint integration)", () => {
    const world = useTestWorld({ modules: [], sandbox: outputProofSandbox() })
    const identity = { userId: world.id(), workspaceId: world.id(), sourceId: world.id() }
    let ordinal = 0
    const chunkOf = (place: KnowledgePlaceTuple): KnowledgePlaceChunk => ({ id: world.id(), ord: ordinal++, ...place })
    beforeAll(async () => {
        world.cleanup(async () => {
            await removeWorkspace(world.db.primary, identity.workspaceId)
            await removeAuthUsers(world.db.primary, [identity.userId])
        })
        await persistKnowledgePlaceScene(world.db.primary, identity)
    })
    const proof: KnowledgePlaceProof = { manager: () => world.db.primary, identity, chunkOf }
    acceptedPlaceCases(proof)
    invalidPlaceCases(proof)
    clearedPlaceCase(proof)
})
