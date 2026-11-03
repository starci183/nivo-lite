import type { EntityManager, DeleteResult, UpdateResult } from "typeorm"
import { builder } from "@starci/jest-preset"
import { agentsEntities } from "@modules/domain/agents"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import { knowledgeGapsEntities } from "@modules/domain/knowledge-gaps"
import { knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"
import { publicDocumentsEntities } from "@modules/domain/public-documents"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"
import { callDbFunction } from "@modules/platform/database"

const AgentEntity: (typeof agentsEntities)[0] = agentsEntities[0]
const KnowledgeChunkEntity: (typeof knowledgeChunksEntities)[0] = knowledgeChunksEntities[0]
const KnowledgeGapEntity: (typeof knowledgeGapsEntities)[0] = knowledgeGapsEntities[0]
const KnowledgeSourceEntity: (typeof knowledgeSourcesEntities)[0] = knowledgeSourcesEntities[0]
const McpToolGrantEntity: (typeof mcpToolGrantsEntities)[0] = mcpToolGrantsEntities[0]
const PublicDocumentEntity: (typeof publicDocumentsEntities)[0] = publicDocumentsEntities[0]
const PublicDocumentSourceEntity: (typeof publicDocumentsEntities)[1] = publicDocumentsEntities[1]
const PublicDocumentApprovalEntity: (typeof publicDocumentsEntities)[2] = publicDocumentsEntities[2]
const WorkspaceMemberEntity: (typeof workspaceMembersEntities)[0] = workspaceMembersEntities[0]
const WorkspaceEntity: (typeof workspacesEntities)[0] = workspacesEntities[0]

/** Explicit identities isolated by the real local world. */
export interface PublicLifecycleIdentity {
    readonly userId: string
    readonly managerId: string
    readonly staffId: string
    readonly workspaceId: string
    readonly sourceId: string
    readonly chunkId: string
    readonly agentId: string
    readonly gapId: string
    readonly documentId: string
}

/** The internal evidence the real MCP search/read pipeline receives. */
export const INTERNAL_HOURS = "Opening hours are Monday to Friday from nine to five."
/** The exact approved public content used by lifecycle scenarios. */
export const PUBLIC_HOURS = "Visit Monday to Friday from nine to five."

type SourceWrite = Pick<
    InstanceType<typeof KnowledgeSourceEntity>,
    "id" | "workspaceId" | "title" | "content" | "kind" | "status" | "visibility" | "origin" | "contentHash"
>
const sourceOf = builder<SourceWrite>({
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    title: "Opening hours",
    content: INTERNAL_HOURS,
    kind: "text",
    status: "ready",
    visibility: "internal",
    origin: "lifecycle-proof",
    contentHash: "hours-v1",
})
type SeatWrite = Pick<
    InstanceType<typeof WorkspaceMemberEntity>,
    "workspaceId" | "userId" | "role" | "displayName" | "status"
>
const seatOf = builder<SeatWrite>({
    workspaceId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    role: "manager",
    displayName: "Manager",
    status: "active",
})
type DocumentWrite = Pick<
    InstanceType<typeof PublicDocumentEntity>,
    "id" | "workspaceId" | "kind" | "status" | "title" | "body" | "question" | "gapId" | "createdBy"
>
const answerOf = builder<DocumentWrite>({
    id: "44444444-4444-4444-8444-444444444444",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    kind: "answer",
    status: "draft",
    title: "Opening hours",
    body: PUBLIC_HOURS,
    question: "Opening hours",
    gapId: "55555555-5555-4555-8555-555555555555",
    createdBy: null,
})
type WorkspaceWrite = Pick<InstanceType<typeof WorkspaceEntity>, "id" | "ownerId" | "name" | "status" | "tierCredits">
const workspaceOf = builder<WorkspaceWrite>({
    id: "22222222-2222-4222-8222-222222222222",
    ownerId: "33333333-3333-4333-8333-333333333333",
    name: "Public document lifecycle proof",
    status: "active",
    tierCredits: "1000000",
})
type ChunkWrite = Pick<
    InstanceType<typeof KnowledgeChunkEntity>,
    "id" | "workspaceId" | "sourceId" | "ord" | "content" | "visibility"
>
const chunkOf = builder<ChunkWrite>({
    id: "66666666-6666-4666-8666-666666666666",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    sourceId: "11111111-1111-4111-8111-111111111111",
    ord: 0,
    content: INTERNAL_HOURS,
    visibility: "internal",
})
type AgentWrite = Pick<
    InstanceType<typeof AgentEntity>,
    "id" | "workspaceId" | "module" | "name" | "handle" | "role" | "instructions"
>
const agentOf = builder<AgentWrite>({
    id: "77777777-7777-4777-8777-777777777777",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    module: "accounting",
    name: "Internal document reader",
    handle: "internal-document-reader",
    role: "Reads internal source evidence",
    instructions: "Read the internal evidence through its granted Brain tools.",
})
type GrantWrite = Pick<InstanceType<typeof McpToolGrantEntity>, "workspaceId" | "agentId" | "tool" | "mode">
const grantOf = builder<GrantWrite>({
    workspaceId: "22222222-2222-4222-8222-222222222222",
    agentId: "77777777-7777-4777-8777-777777777777",
    tool: "brain.search",
    mode: "auto",
})
type GapWrite = Pick<
    InstanceType<typeof KnowledgeGapEntity>,
    "id" | "workspaceId" | "module" | "question" | "questionKey" | "keywords"
>
const gapOf = builder<GapWrite>({
    id: "55555555-5555-4555-8555-555555555555",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    module: "chatbot",
    question: "Opening hours",
    questionKey: "opening-hours",
    keywords: ["opening", "hours"],
})
type ReferenceWrite = Pick<
    InstanceType<typeof PublicDocumentSourceEntity>,
    "documentId" | "workspaceId" | "sourceId" | "sourceTitle" | "contentHash"
>
const referenceOf = builder<ReferenceWrite>({
    documentId: "44444444-4444-4444-8444-444444444444",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    sourceId: "11111111-1111-4111-8111-111111111111",
    sourceTitle: "Opening hours",
    contentHash: "hours-v1",
})

/** Persists real accounts, the workspace owner trigger, two other roles and internal knowledge under unchanged constraints. */
export const persistPublicLifecycleScene = (manager: EntityManager, id: PublicLifecycleIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await Promise.all(
            [id.userId, id.managerId, id.staffId].map((userId) =>
                callDbFunction(tx, "public.be_auth_create_user", [
                    userId,
                    `${userId}@example.test`,
                    null,
                    true,
                    "{}",
                    new Date("2026-11-02T00:00:00.000Z"),
                ]),
            ),
        )
        await tx.insert(WorkspaceEntity, workspaceOf({ id: id.workspaceId, ownerId: id.userId }))
        await tx.update(
            WorkspaceMemberEntity,
            { workspaceId: id.workspaceId, userId: id.userId },
            { displayName: "Owner" },
        )
        await tx.insert(WorkspaceMemberEntity, [
            seatOf({ workspaceId: id.workspaceId, userId: id.managerId }),
            seatOf({ workspaceId: id.workspaceId, userId: id.staffId, role: "staff", displayName: "Staff" }),
        ])
        await tx.insert(KnowledgeSourceEntity, sourceOf({ id: id.sourceId, workspaceId: id.workspaceId }))
        await tx.insert(
            KnowledgeChunkEntity,
            chunkOf({
                id: id.chunkId,
                workspaceId: id.workspaceId,
                sourceId: id.sourceId,
            }),
        )
    })

/** Gives a real staff-facing agent the two actual native Brain tool grants required by the drafting runner. */
export const persistPublicDraftingAgent = (manager: EntityManager, id: PublicLifecycleIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await tx.insert(AgentEntity, agentOf({ id: id.agentId, workspaceId: id.workspaceId }))
        await tx.insert(
            McpToolGrantEntity,
            ["brain.search", "brain.documents.read"].map((tool) =>
                grantOf({
                    workspaceId: id.workspaceId,
                    agentId: id.agentId,
                    tool,
                }),
            ),
        )
    })

/** Persists a never-published customer-answer proposal and its draft-source evidence, as the completed generation would. */
export const persistPublicAnswer = (manager: EntityManager, id: PublicLifecycleIdentity): Promise<void> =>
    manager.transaction(async (tx) => {
        await tx.insert(
            KnowledgeGapEntity,
            gapOf({
                id: id.gapId,
                workspaceId: id.workspaceId,
                questionKey: `opening-hours-${id.gapId}`,
            }),
        )
        await tx.insert(
            PublicDocumentEntity,
            answerOf({ id: id.documentId, workspaceId: id.workspaceId, gapId: id.gapId }),
        )
        await tx.insert(
            PublicDocumentSourceEntity,
            referenceOf({
                documentId: id.documentId,
                workspaceId: id.workspaceId,
                sourceId: id.sourceId,
            }),
        )
    })

/** Arranges completed indexing without replacing any domain provider; mutation tests start from the actual idle source state. */
export const finishPublicIndexFixture = async (
    manager: EntityManager,
    workspaceId: string,
    sourceId: string,
): Promise<void> => {
    await manager.update(
        KnowledgeSourceEntity,
        { id: sourceId, workspaceId },
        { status: "ready", contentHash: "public-v1" },
    )
}

/** Stores a finished public passage so withdrawal exercises the real source-chunk cascade. */
export const persistPublicIndexedPassage = async (
    manager: EntityManager,
    workspaceId: string,
    sourceId: string,
    chunkId: string,
): Promise<void> => {
    await manager.insert(
        KnowledgeChunkEntity,
        chunkOf({ id: chunkId, workspaceId, sourceId, content: PUBLIC_HOURS, visibility: "public" }),
    )
}

/** A real foreign owner of the would-be publication id makes PublishedSourcesService refuse after the approval insert. */
export const persistConflictingPublication = async (
    manager: EntityManager,
    workspaceId: string,
    sourceId: string,
): Promise<void> => {
    await manager.insert(KnowledgeSourceEntity, sourceOf({ id: sourceId, workspaceId, title: "Other owner" }))
}

/** Arranges a newly indexed internal source version for review-drift scenarios without touching immutable approval history. */
export const advancePublicInternalEvidence = async (
    manager: EntityManager,
    id: PublicLifecycleIdentity,
    contentHash: string,
): Promise<void> => {
    await manager.update(
        KnowledgeSourceEntity,
        { id: id.sourceId, workspaceId: id.workspaceId },
        {
            content: `${INTERNAL_HOURS} Appointments may be requested.`,
            contentHash,
        },
    )
}

/** Attempts a forbidden rewrite through the real role-bound manager; assertions remain in the integration spec. */
export const rewritePublicApprovalFixture = (manager: EntityManager, documentId: string): Promise<UpdateResult> =>
    manager.update(PublicDocumentApprovalEntity, { documentId }, { body: "Tampered" })

/** Attempts deletion of immutable approval history without bypassing its actual grants. */
export const deletePublicApprovalFixture = (manager: EntityManager, documentId: string): Promise<DeleteResult> =>
    manager.delete(PublicDocumentApprovalEntity, { documentId })

/** Attempts deletion of an approved parent under its real deferred foreign key. */
export const deletePublicDocumentFixture = (manager: EntityManager, id: string): Promise<DeleteResult> =>
    manager.delete(PublicDocumentEntity, { id })

/** Deletes the whole workspace through the same manager so both deferred sides are checked together. */
export const deletePublicWorkspaceFixture = (manager: EntityManager, id: string): Promise<DeleteResult> =>
    manager.delete(WorkspaceEntity, { id })
