import { KnowledgeSourcesService, knowledgeSourcesEntities } from "@modules/domain/knowledge-sources"
import { knowledgeChunksEntities } from "@modules/domain/knowledge-chunks"
import {
    PublicDocumentsService,
    PublicDraftRunService,
    publicDocumentsEntities,
} from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { jobsEntities } from "@modules/platform/jobs"
import {
    advancePublicInternalEvidence,
    rewritePublicApprovalFixture,
    deletePublicApprovalFixture,
    deletePublicDocumentFixture,
    deletePublicWorkspaceFixture,
    finishPublicIndexFixture,
    persistConflictingPublication,
    persistPublicAnswer,
    persistPublicDraftingAgent,
    persistPublicIndexedPassage,
    persistPublicLifecycleScene,
    PUBLIC_HOURS,
} from "../../fixtures/builders/public-documents-lifecycle.builder"
import type { PublicLifecycleIdentity } from "../../fixtures/builders/public-documents-lifecycle.builder"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { enforcePublicApprovalPointer, enforcePublicHistoryParent } from "../../world/public-documents-database.service"
import { usePublicDocumentsModel } from "../../world/public-documents-model.service"
import { outputProofSandbox } from "../../world/output-proof-sandbox.service"
import { useTestWorld } from "../../world/use-test-world"

const [KnowledgeSourceEntity] = knowledgeSourcesEntities
const [KnowledgeChunkEntity] = knowledgeChunksEntities
const [PublicDocumentEntity, PublicDocumentSourceEntity, PublicDocumentApprovalEntity] = publicDocumentsEntities
const [, JobOutboxEntity] = jobsEntities

const model = usePublicDocumentsModel()
const world = useTestWorld({ modules: model.modules, sandbox: outputProofSandbox() })
const reply = model.reply
afterAll(model.close)
const documents = () => world.resolve(PublicDocumentsService)
const drafts = () => world.resolve(PublicDraftRunService)
const fixture = async (): Promise<PublicLifecycleIdentity> => {
    const id = {
        userId: world.id(),
        managerId: world.id(),
        staffId: world.id(),
        workspaceId: world.id(),
        sourceId: world.id(),
        chunkId: world.id(),
        agentId: world.id(),
        gapId: world.id(),
        documentId: world.id(),
    }
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, id.workspaceId)
        await removeAuthUsers(world.db.primary, [id.userId, id.managerId, id.staffId])
    })
    await persistPublicLifecycleScene(world.db.primary, id)
    return id
}
const approvals = (documentId: string) =>
    world.db.primary.find(PublicDocumentApprovalEntity, {
        where: { documentId },
        order: { draftRevision: "ASC" },
        take: 20,
    })
const source = (workspaceId: string, id: string) =>
    world.db.primary.findOne(KnowledgeSourceEntity, { where: { workspaceId, id } })
const indexJobs = (workspaceId: string) =>
    world.db.primary.find(JobOutboxEntity, {
        select: { name: true, payload: true },
        where: { workspaceId, name: "knowledge.index" },
        take: 20,
    })
const write = (id: PublicLifecycleIdentity) =>
    documents().write(id.userId, id.workspaceId, { title: "Opening hours", body: PUBLIC_HOURS })

const exactApproval = (): void =>
    it("keeps a draft private, then commits its exact revision, actor, immutable history and index handoff", async () => {
        const id = await fixture()
        const draft = await write(id)
        expect(await source(id.workspaceId, draft.id)).toBeNull()
        expect(await approvals(draft.id)).toEqual([])
        expect(await indexJobs(id.workspaceId)).toEqual([])
        const approved = await documents().approve(id.userId, id.workspaceId, {
            id: draft.id,
            expectedDraftRevision: draft.draftRevision,
        })
        const stored = await world.db.primary.findOne(PublicDocumentEntity, { where: { id: draft.id } })
        expect(approved).toMatchObject({ status: "published", body: PUBLIC_HOURS, publishedBody: PUBLIC_HOURS })
        expect(stored).toMatchObject({
            publishedRevision: draft.draftRevision,
            approvedBy: id.userId,
            approvedByName: "Owner",
        })
        expect(await approvals(draft.id)).toEqual([
            {
                documentId: draft.id,
                workspaceId: id.workspaceId,
                draftRevision: draft.draftRevision,
                title: "Opening hours",
                body: PUBLIC_HOURS,
                draftSources: [],
                reviewedSources: [],
                approvedBy: id.userId,
                approvedByName: "Owner",
                approvedAt: stored?.approvedAt,
            },
        ])
        expect(await source(id.workspaceId, draft.id)).toMatchObject({
            id: draft.id,
            content: PUBLIC_HOURS,
            visibility: "public",
            origin: "public_document",
            status: "queued",
        })
        expect(await indexJobs(id.workspaceId)).toEqual([
            { name: "knowledge.index", payload: { sourceId: draft.id, workspaceId: id.workspaceId } },
        ])
    })

const staleApproval = (): void =>
    it.each(["body", "title"] as const)(
        "refuses a stale reviewed %s revision without any publication, history or handoff",
        async (field) => {
            const id = await fixture()
            const before = await write(id)
            const changed = await documents().update(id.managerId, id.workspaceId, {
                id: before.id,
                ...(field === "body" ? { body: "Visit on Saturday." } : { title: "Saturday hours" }),
            })
            expect(changed.draftRevision).toBe(before.draftRevision + 1)
            await expect(
                documents().approve(id.userId, id.workspaceId, {
                    id: before.id,
                    expectedDraftRevision: before.draftRevision,
                }),
            ).rejects.toMatchObject({ code: "PUBLIC_DOCUMENTS_STALE_REVIEW" })
            expect(await source(id.workspaceId, before.id)).toBeNull()
            expect(await approvals(before.id)).toEqual([])
            expect(await indexJobs(id.workspaceId)).toEqual([])
            expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: before.id } })).toMatchObject({
                body: field === "body" ? "Visit on Saturday." : PUBLIC_HOURS,
                title: field === "title" ? "Saturday hours" : "Opening hours",
                publishedBody: null,
                approvedBy: null,
            })
        },
    )

const approvalReplay = (): void =>
    it("serializes concurrent approval replays into one publication and preserves its first actor", async () => {
        const id = await fixture()
        const draft = await write(id)
        const request = { id: draft.id, expectedDraftRevision: draft.draftRevision }
        await Promise.all([
            documents().approve(id.userId, id.workspaceId, request),
            documents().approve(id.userId, id.workspaceId, request),
        ])
        const original = await approvals(draft.id)
        await documents().approve(id.managerId, id.workspaceId, request)
        expect(await approvals(draft.id)).toEqual(original)
        expect(original).toHaveLength(1)
        expect(original[0]).toMatchObject({ approvedBy: id.userId, approvedByName: "Owner" })
        expect(await indexJobs(id.workspaceId)).toEqual([
            { name: "knowledge.index", payload: { sourceId: draft.id, workspaceId: id.workspaceId } },
        ])
    })

const publicationRollback = (): void =>
    it("rolls an inserted audit back when the real publication owner refuses the source", async () => {
        const id = await fixture()
        const draft = await write(id)
        await persistConflictingPublication(world.db.primary, id.workspaceId, draft.id)
        const foreign = await source(id.workspaceId, draft.id)
        await expect(
            documents().approve(id.userId, id.workspaceId, {
                id: draft.id,
                expectedDraftRevision: draft.draftRevision,
            }),
        ).rejects.toMatchObject({ code: "KNOWLEDGE_SOURCES_NOT_FOUND" })
        expect(await approvals(draft.id)).toEqual([])
        expect(await source(id.workspaceId, draft.id)).toEqual(foreign)
        expect(await indexJobs(id.workspaceId)).toEqual([])
        expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: draft.id } })).toMatchObject({
            status: "draft",
            publishedBody: null,
            publishedRevision: null,
            approvedBy: null,
        })
    })

const approvalActors = (): void =>
    it("refuses staff and foreign-workspace actors before recording approval", async () => {
        const id = await fixture()
        const foreign = await fixture()
        const draft = await write(id)
        const request = { id: draft.id, expectedDraftRevision: draft.draftRevision }
        await expect(documents().approve(id.staffId, id.workspaceId, request)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_ROLE_FORBIDDEN",
        })
        await expect(documents().approve(foreign.userId, id.workspaceId, request)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        await world.resolve(WorkspaceMembersService).setStatus(id.userId, id.workspaceId, id.managerId, "disabled")
        await expect(documents().approve(id.managerId, id.workspaceId, request)).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        expect(await approvals(draft.id)).toEqual([])
        expect(await source(id.workspaceId, draft.id)).toBeNull()
        expect(await indexJobs(id.workspaceId)).toEqual([])
    })

const archiveRace = (): void =>
    it("leaves no live source when archive races approval on the same document", async () => {
        const id = await fixture()
        const draft = await write(id)
        const [approval] = await Promise.allSettled([
            documents().approve(id.userId, id.workspaceId, {
                id: draft.id,
                expectedDraftRevision: draft.draftRevision,
            }),
            documents().archive(id.managerId, id.workspaceId, draft.id),
        ])
        expect(await source(id.workspaceId, draft.id)).toBeNull()
        expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: draft.id } })).toMatchObject({
            status: "archived",
        })
        if (approval?.status === "fulfilled") {
            expect(await approvals(draft.id)).toHaveLength(1)
        } else {
            const failure: unknown = approval?.reason
            expect(failure).toMatchObject({ code: "PUBLIC_DOCUMENTS_NOT_EDITABLE" })
            expect(await approvals(draft.id)).toEqual([])
        }
    })

const genericMutations = (): void =>
    it("refuses generic content, metadata and delete mutations and preserves the approved source", async () => {
        const id = await fixture()
        const draft = await write(id)
        await documents().approve(id.userId, id.workspaceId, {
            id: draft.id,
            expectedDraftRevision: draft.draftRevision,
        })
        await finishPublicIndexFixture(world.db.primary, id.workspaceId, draft.id)
        const before = await source(id.workspaceId, draft.id)
        const history = await approvals(draft.id)
        const generic = world.resolve(KnowledgeSourcesService)
        await expect(
            generic.reindexSource(id.managerId, id.workspaceId, {
                sourceId: draft.id,
                content: "Unapproved replacement",
            }),
        ).rejects.toMatchObject({ code: "KNOWLEDGE_SOURCES_PUBLIC_BY_APPROVAL" })
        await expect(
            generic.updateSource(id.managerId, id.workspaceId, { sourceId: draft.id, title: "Unapproved title" }),
        ).rejects.toMatchObject({ code: "KNOWLEDGE_SOURCES_PUBLIC_BY_APPROVAL" })
        await expect(generic.removeSource(id.managerId, id.workspaceId, draft.id)).rejects.toMatchObject({
            code: "KNOWLEDGE_SOURCES_PUBLIC_BY_APPROVAL",
        })
        expect(await source(id.workspaceId, draft.id)).toEqual(before)
        expect(await approvals(draft.id)).toEqual(history)
        expect(await indexJobs(id.workspaceId)).toHaveLength(1)
    })

const changedEvidence = (): void =>
    it("acknowledges changed source evidence in a new immutable revision without reindexing the same public text", async () => {
        const id = await fixture()
        await persistPublicAnswer(world.db.primary, id)
        await documents().approve(id.userId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 0 })
        const first = await approvals(id.documentId)
        const published = await source(id.workspaceId, id.documentId)
        await advancePublicInternalEvidence(world.db.primary, id, "hours-v2")
        expect((await documents().list(id.userId, id.workspaceId))[0]).toMatchObject({ needsReview: true })
        await expect(
            documents().approve(id.managerId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 0 }),
        ).rejects.toMatchObject({ code: "PUBLIC_DOCUMENTS_SOURCES_CHANGED" })
        const reviewed = await documents().approve(id.managerId, id.workspaceId, {
            id: id.documentId,
            expectedDraftRevision: 0,
            reviewedChanges: true,
        })
        expect(reviewed).toMatchObject({ draftRevision: 1, needsReview: false, publishedBody: PUBLIC_HOURS })
        const history = await approvals(id.documentId)
        expect(history).toHaveLength(2)
        expect(history[0]).toEqual(first[0])
        expect(history[1]).toMatchObject({
            draftRevision: 1,
            body: PUBLIC_HOURS,
            approvedBy: id.managerId,
            draftSources: [{ sourceId: id.sourceId, title: "Opening hours", contentHash: "hours-v1" }],
            reviewedSources: [
                {
                    sourceId: id.sourceId,
                    title: "Opening hours",
                    contentHash: "hours-v2",
                    current: {
                        id: id.sourceId,
                        title: "Opening hours",
                        visibility: "internal",
                        status: "ready",
                        contentHash: "hours-v2",
                    },
                },
            ],
        })
        await documents().approve(id.userId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 1 })
        expect(await approvals(id.documentId)).toEqual(history)
        expect(await source(id.workspaceId, id.documentId)).toEqual(published)
        expect(await indexJobs(id.workspaceId)).toHaveLength(1)
        await advancePublicInternalEvidence(world.db.primary, id, "hours-v3")
        expect((await documents().list(id.userId, id.workspaceId))[0]).toMatchObject({
            needsReview: true,
            draftRevision: 1,
        })
    })

const failedReading = (): void =>
    it("keeps a published answer and immutable history when internal reading is no longer granted", async () => {
        const id = await fixture()
        await persistPublicAnswer(world.db.primary, id)
        await documents().approve(id.userId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 0 })
        await finishPublicIndexFixture(world.db.primary, id.workspaceId, id.documentId)
        await persistPublicIndexedPassage(world.db.primary, id.workspaceId, id.documentId, world.id())
        const history = await approvals(id.documentId)
        const publicSource = await source(id.workspaceId, id.documentId)
        const redraft = await documents().redraft(id.userId, id.workspaceId, id.documentId)
        const payload = {
            documentId: id.documentId,
            workspaceId: id.workspaceId,
            draftRevision: redraft.draftRevision,
        }
        await drafts().generate(payload)
        expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: id.documentId } })).toMatchObject({
            status: "published",
            publishedBody: PUBLIC_HOURS,
            failureCode: "PUBLIC_DOCUMENTS_NO_INTERNAL_RIGHT",
        })
        expect(await source(id.workspaceId, id.documentId)).toEqual(publicSource)
        expect(await world.db.primary.count(KnowledgeChunkEntity, { where: { sourceId: id.documentId } })).toBe(1)
        expect(await approvals(id.documentId)).toEqual(history)
    })

const sameSourceRedraft = (): void =>
    it("replaces the same-source answer provenance through real MCP and the model HTTP boundary", async () => {
        const id = await fixture()
        await persistPublicDraftingAgent(world.db.primary, id)
        await persistPublicAnswer(world.db.primary, id)
        await documents().approve(id.userId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 0 })
        const firstApproval = await approvals(id.documentId)
        await finishPublicIndexFixture(world.db.primary, id.workspaceId, id.documentId)
        const redraft = await documents().redraft(id.userId, id.workspaceId, id.documentId)
        await reply("Our opening hours remain Monday to Friday, nine to five.")
        expect(
            await drafts().generate({
                documentId: id.documentId,
                workspaceId: id.workspaceId,
                draftRevision: redraft.draftRevision,
            }),
        ).toBe("done")
        const [settled] = await documents().list(id.userId, id.workspaceId)
        expect(settled).toMatchObject({
            body: "Our opening hours remain Monday to Friday, nine to five.",
            publishedBody: PUBLIC_HOURS,
            status: "published",
            draftRevision: redraft.draftRevision + 1,
        })
        expect(
            await world.db.primary.find(PublicDocumentSourceEntity, {
                where: { documentId: id.documentId },
                take: 6,
            }),
        ).toMatchObject([{ sourceId: id.sourceId, contentHash: "hours-v1" }])
        expect(await approvals(id.documentId)).toEqual(firstApproval)
        await expect(
            documents().approve(id.managerId, id.workspaceId, {
                id: id.documentId,
                expectedDraftRevision: redraft.draftRevision,
            }),
        ).rejects.toMatchObject({ code: "PUBLIC_DOCUMENTS_STALE_REVIEW" })
        await documents().approve(id.managerId, id.workspaceId, {
            id: id.documentId,
            expectedDraftRevision: redraft.draftRevision + 1,
        })
        const history = await approvals(id.documentId)
        expect(history).toHaveLength(2)
        expect(history[0]).toEqual(firstApproval[0])
        expect(history[1]).toMatchObject({
            approvedBy: id.managerId,
            body: "Our opening hours remain Monday to Friday, nine to five.",
            draftSources: [{ sourceId: id.sourceId, title: "Opening hours", contentHash: "hours-v1" }],
        })
        expect(await source(id.workspaceId, id.documentId)).toMatchObject({
            content: "Our opening hours remain Monday to Friday, nine to five.",
            visibility: "public",
        })
    })

const workerFence = (): void =>
    it("fences an old failure and an archived worker while withdrawing the live source", async () => {
        const id = await fixture()
        await persistPublicAnswer(world.db.primary, id)
        await documents().approve(id.userId, id.workspaceId, { id: id.documentId, expectedDraftRevision: 0 })
        await finishPublicIndexFixture(world.db.primary, id.workspaceId, id.documentId)
        await persistPublicIndexedPassage(world.db.primary, id.workspaceId, id.documentId, world.id())
        const redraft = await documents().redraft(id.userId, id.workspaceId, id.documentId)
        await drafts().fail({ documentId: id.documentId, workspaceId: id.workspaceId, draftRevision: 0 })
        expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: id.documentId } })).toMatchObject({
            status: "drafting",
            draftRevision: redraft.draftRevision,
        })
        await documents().archive(id.userId, id.workspaceId, id.documentId)
        const payload = {
            documentId: id.documentId,
            workspaceId: id.workspaceId,
            draftRevision: redraft.draftRevision,
        }
        await drafts().fail(payload)
        expect(await drafts().generate(payload)).toBe("skipped")
        expect(await source(id.workspaceId, id.documentId)).toBeNull()
        expect(await world.db.primary.count(KnowledgeChunkEntity, { where: { sourceId: id.documentId } })).toBe(0)
        expect(await world.db.primary.findOne(PublicDocumentEntity, { where: { id: id.documentId } })).toMatchObject({
            status: "archived",
            publishedBody: PUBLIC_HOURS,
        })
        expect(await approvals(id.documentId)).toHaveLength(1)
    })

const historyPrivileges = (): void =>
    it("refuses actual app_be history mutation and parent deletion, while allowing whole-workspace cleanup", async () => {
        const id = await fixture()
        const draft = await write(id)
        await documents().approve(id.userId, id.workspaceId, {
            id: draft.id,
            expectedDraftRevision: draft.draftRevision,
        })
        const history = await approvals(draft.id)
        await expect(
            withBackendRole(world, async (manager) => {
                await rewritePublicApprovalFixture(manager, draft.id)
            }),
        ).rejects.toMatchObject({ driverError: { code: "42501" } })
        await expect(
            withBackendRole(world, async (manager) => {
                await deletePublicApprovalFixture(manager, draft.id)
            }),
        ).rejects.toMatchObject({ driverError: { code: "42501" } })
        await expect(
            withBackendRole(world, async (manager) => {
                await deletePublicDocumentFixture(manager, draft.id)
                await enforcePublicHistoryParent(manager)
            }),
        ).rejects.toMatchObject({
            driverError: { code: "23503", constraint: "public_document_approvals_document_id_fkey" },
        })
        expect(await approvals(draft.id)).toEqual(history)
        expect(await source(id.workspaceId, draft.id)).toMatchObject({ content: PUBLIC_HOURS })
        await withBackendRole(world, async (manager) => {
            await deletePublicWorkspaceFixture(manager, id.workspaceId)
            await enforcePublicHistoryParent(manager)
            await enforcePublicApprovalPointer(manager)
            expect(await manager.count(PublicDocumentApprovalEntity, { where: { workspaceId: id.workspaceId } })).toBe(
                0,
            )
        })
        expect(await approvals(draft.id)).toEqual(history)
    })

describe("PublicDocumentsService (persisted local lifecycle integration)", () => {
    describe("approve", () => {
        exactApproval()
        staleApproval()
        approvalReplay()
        publicationRollback()
        approvalActors()
    })
    describe("publication ownership", () => {
        archiveRace()
        genericMutations()
    })
    describe("redraft", () => {
        changedEvidence()
        failedReading()
        sameSourceRedraft()
        workerFence()
    })
    describe("immutable approval privileges", () => {
        historyPrivileges()
    })
})
