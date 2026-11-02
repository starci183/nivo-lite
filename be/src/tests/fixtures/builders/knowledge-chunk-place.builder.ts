import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { workspacesEntities } from "@modules/domain/workspaces"
import { callDbFunction } from "@modules/platform/database"

const [KnowledgeChunkEntity] = knowledgeChunksEntities
const [KnowledgeSourceEntity] = knowledgeSourcesEntities
const [WorkspaceEntity] = workspacesEntities

/** The real parent chain of one constraint proof; every identity comes from the isolated world. */
export interface KnowledgePlaceIdentity {
    readonly userId: string
    readonly workspaceId: string
    readonly sourceId: string
}

/** Nullable persisted values are deliberately wider than the accepted domain values, so the database must reject invalid tuples. */
export interface KnowledgePlaceTuple {
    readonly placeKind: string | null
    readonly placeLabel: string | null
}

/** One chunk's distinct identity and source order, supplied by the proof rather than inferred from an ambient counter. */
export interface KnowledgePlaceChunk extends KnowledgePlaceTuple {
    readonly id: string
    readonly ord: number
}

type ChunkWrite = Pick<
    InstanceType<typeof KnowledgeChunkEntity>,
    "id" | "workspaceId" | "sourceId" | "ord" | "content" | "visibility" | "placeKind" | "placeLabel"
>

const chunkOf = builder<ChunkWrite>({
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    sourceId: "33333333-3333-4333-8333-333333333333",
    ord: 0,
    content: "A passage whose source does not name a place.",
    visibility: "internal",
    placeKind: null,
    placeLabel: null,
})

/** Creates an account, workspace and source through their actual database interfaces, leaving every constraint enabled. */
export const persistKnowledgePlaceScene = (manager: EntityManager, identity: KnowledgePlaceIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await callDbFunction(tx, "public.be_auth_create_user", [
            identity.userId,
            `${identity.userId}@example.test`,
            null,
            true,
            "{}",
            new Date("2026-11-01T00:00:00.000Z"),
        ])
        await tx.insert(WorkspaceEntity, {
            id: identity.workspaceId,
            ownerId: identity.userId,
            name: "Knowledge place constraint proof",
        })
        await tx.insert(KnowledgeSourceEntity, {
            id: identity.sourceId,
            workspaceId: identity.workspaceId,
            kind: "text",
            title: "Constraint proof source",
            content: "A passage with optional source location metadata.",
        })
    })

/** Stores one addressed chunk under the valid parent chain; an invalid place is left for the actual SQL CHECK to refuse. */
export const persistKnowledgePlaceChunk = async (
    manager: EntityManager,
    identity: KnowledgePlaceIdentity,
    chunk: KnowledgePlaceChunk,
): Promise<void> => {
    await manager.insert(
        KnowledgeChunkEntity,
        chunkOf({ workspaceId: identity.workspaceId, sourceId: identity.sourceId, ...chunk }),
    )
}

/** Changes one real tuple so the constraint, rather than a fixture guard, decides whether the write is accepted. */
export const updateKnowledgePlaceChunk = async (
    manager: EntityManager,
    identity: KnowledgePlaceIdentity,
    chunkId: string,
    place: KnowledgePlaceTuple,
): Promise<void> => {
    await manager.update(KnowledgeChunkEntity, { id: chunkId, workspaceId: identity.workspaceId }, place)
}
