import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesReadService, PublishedSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceState } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectKnowledgeQueue } from "@modules/queues/knowledge"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import { PublicDocumentsError, PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { PublicDocumentEntity, PublicDocumentSourceEntity, PublicDocumentApprovalEntity } from "./persistence/entities"
import { toPublicDocumentView } from "./public-document.mapper"
import { MAX_BODY_CHARS, MAX_DRAFT_SOURCES, MAX_TITLE_CHARS } from "./public-documents.contracts"
import type {
    ApproveRequest,
    PublicDocumentDraftRequest,
    PublicDocumentView,
    SourceRecordRef,
    UpdateRequest,
    WriteRequest,
} from "./public-documents.contracts"
import { changedSourceIds, changedReviewSourceIds, reviewedSourcesOf } from "./staleness.policy"

/** An internal source whose completed content hash was checked for a draft request. */
interface ReadySource extends SourceState {
    readonly contentHash: string
}

/** Who may write, approve and withdraw what customers read. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The most documents the page lists. */
const LIST_MAX = 200

/** The longest note an owner may give NIVO for a draft. */
const INSTRUCTIONS_CHARS = 1_000

/** The statuses in which the owner may change the text. */
const EDITABLE: ReadonlySet<PublicDocumentEntity["status"]> = new Set<PublicDocumentEntity["status"]>([
    "draft",
    "published",
    "failed",
])

/** The statuses a document may be approved from. */
const APPROVABLE: ReadonlySet<PublicDocumentEntity["status"]> = new Set<PublicDocumentEntity["status"]>([
    "draft",
    "published",
])

/** The statuses a draft may be asked for again from. */
const REDRAFTABLE: ReadonlySet<PublicDocumentEntity["status"]> = new Set<PublicDocumentEntity["status"]>([
    "draft",
    "published",
    "failed",
])

/** The most internal sources of the documents one read looks at: every document has five at most. */
const SOURCE_ROWS_MAX = LIST_MAX * MAX_DRAFT_SOURCES

/** The committed publication identity and whether this call created its approval. */
interface PublicApprovalResult {
    /** The document whose publication transaction committed. */
    readonly id: string
    /** The customer question it answers, when present. */
    readonly gapId: string | null
    /** Whether this call created a new approval rather than replaying one. */
    readonly published: boolean
}

const titleOf = (title: string): string => {
    const text = title.trim().slice(0, MAX_TITLE_CHARS)
    if (text === "") throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.TitleRequired })
    return text
}

const bodyOf = (body: string): string => {
    if (body.length > MAX_BODY_CHARS) {
        throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.BodyTooLong, params: { max: MAX_BODY_CHARS } })
    }
    return body.trim()
}

@Injectable()
/**
 * What customers may read, written apart from what the team knows. An owner or a manager writes a public document or asks NIVO to
 * draft one from internal documents; NIVO shows what it left out; a person approves; only then does a public source exist for it,
 * with the approver, the time and the internal sources on record. No internal document is turned into a public one.
 */
export class PublicDocumentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly sources: KnowledgeSourcesReadService,
        private readonly published: PublishedSourcesService,
        @InjectKnowledgeQueue() private readonly queue: KnowledgeQueue,
        private readonly gaps: KnowledgeGapsService,
    ) {}

    /** The public documents of the workspace that are not archived, latest change first. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<PublicDocumentView>> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const rows = await this.entityManager.find(PublicDocumentEntity, {
            where: { workspaceId, status: Not("archived") },
            order: { updatedAt: "DESC" },
            take: LIST_MAX,
        })
        return this.viewsOf(workspaceId, rows)
    }

    /** How many proposals wait for the owner: answers NIVO found in the internal documents for a customer question, not yet approved. The caller proved the role. */
    countProposals(workspaceId: string): Promise<number> {
        return this.entityManager.count(PublicDocumentEntity, {
            where: { workspaceId, kind: "answer", status: "draft" },
        })
    }

    /** Writes a public document by hand: a draft the owner can approve when it is ready. */
    async write(userId: string, workspaceId: string, request: WriteRequest): Promise<PublicDocumentView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const inserted = await this.entityManager.insert(PublicDocumentEntity, {
            workspaceId,
            title: titleOf(request.title),
            body: bodyOf(request.body),
            kind: "written",
            status: "draft",
            createdBy: userId,
        })
        return this.viewOf(workspaceId, this.idOf(inserted.identifiers))
    }

    /**
     * Asks NIVO to draft a public document from internal documents. The row exists at once as `drafting` and a job writes it: the job
     * reads each internal document through NIVO MCP while no customer is present. Every source must be internal and fully read.
     */
    async requestDraft(
        userId: string,
        workspaceId: string,
        request: PublicDocumentDraftRequest,
    ): Promise<PublicDocumentView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const title = titleOf(request.title)
        const states = await this.readySources(workspaceId, request.sourceIds)
        const id = await this.entityManager.transaction(async (tx) => {
            const inserted = await tx.insert(PublicDocumentEntity, {
                workspaceId,
                title,
                kind: "drafted",
                status: "drafting",
                instructions: request.instructions?.trim().slice(0, INSTRUCTIONS_CHARS) || null,
                createdBy: userId,
            })
            const documentId = this.idOf(inserted.identifiers)
            await tx.insert(
                PublicDocumentSourceEntity,
                states.map((state) => ({
                    documentId,
                    sourceId: state.id,
                    workspaceId,
                    sourceTitle: state.title,
                    contentHash: state.contentHash,
                })),
            )
            await this.queue.enqueuePublicDraft({ documentId, workspaceId, draftRevision: 0 }, tx)
            return documentId
        })
        return this.viewOf(workspaceId, id)
    }

    /** Asks NIVO to draft the document again from the internal documents it was drafted from, as they are now. */
    async redraft(userId: string, workspaceId: string, id: string): Promise<PublicDocumentView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const row = await this.rowOf(workspaceId, id)
        const recorded = await this.recordedOf(workspaceId, [id])
        if (!REDRAFTABLE.has(row.status) || recorded.length === 0) {
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotEditable })
        }
        await this.entityManager.transaction(async (tx) => {
            const draftRevision = row.draftRevision + 1
            const changed = await tx.update(
                PublicDocumentEntity,
                { id, workspaceId, status: row.status, draftRevision: row.draftRevision },
                { status: "drafting", failureCode: null, draftRevision },
            )
            if ((changed.affected ?? 0) !== 1)
                throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotEditable })
            await this.queue.enqueuePublicDraft({ documentId: id, workspaceId, draftRevision }, tx)
        })
        return this.viewOf(workspaceId, id)
    }

    /** Changes the title or the text being worked on; a published document keeps serving its approved text until the new one is approved. */
    async update(userId: string, workspaceId: string, request: UpdateRequest): Promise<PublicDocumentView> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const row = await this.rowOf(workspaceId, request.id)
        if (!EDITABLE.has(row.status)) throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotEditable })
        const changed = await this.entityManager.update(
            PublicDocumentEntity,
            { id: row.id, workspaceId, status: row.status, draftRevision: row.draftRevision },
            {
                ...(request.title === undefined ? {} : { title: titleOf(request.title) }),
                ...(request.body === undefined ? {} : { body: bodyOf(request.body) }),
                status: row.status === "failed" ? "draft" : row.status,
                failureCode: null,
                draftRevision: row.draftRevision + 1,
            },
        )
        if ((changed.affected ?? 0) !== 1)
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotEditable })
        return this.viewOf(workspaceId, row.id)
    }

    /**
     * Approves the text as it stands and publishes it: the approver, the time and the internal sources are recorded and the text
     * becomes its own public source. When an internal source changed since, the owner confirms they looked at the change first.
     */
    async approve(userId: string, workspaceId: string, request: ApproveRequest): Promise<PublicDocumentView> {
        const member = await this.members.require(userId, workspaceId, MANAGERS)
        const row = await this.entityManager.transaction((tx) =>
            this.approveIn(tx, userId, workspaceId, request, member.displayName),
        )
        if (row.published) await this.published.announce(workspaceId, row.id)
        if (row.gapId !== null) await this.gaps.answer(workspaceId, row.gapId, `document:${row.id}`)
        return this.viewOf(workspaceId, row.id)
    }

    /** Locks the reviewed content, records its immutable approval and publishes that exact text in the caller's transaction. */
    private async approveIn(
        tx: EntityManager,
        userId: string,
        workspaceId: string,
        request: ApproveRequest,
        approverName: string | null,
    ): Promise<PublicApprovalResult> {
        const current = await this.lockedRowOf(tx, workspaceId, request.id)
        if (request.expectedDraftRevision !== current.draftRevision)
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.StaleReview })
        if (!APPROVABLE.has(current.status))
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotEditable })
        if (current.body.trim() === "") throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.BodyRequired })
        const samePublished =
            current.publishedRevision === current.draftRevision && current.publishedBody === current.body
        const recorded = await this.recordedOf(workspaceId, [current.id], tx)
        const states = await this.sources.statesOf(
            workspaceId,
            recorded.map((source) => source.sourceId),
            tx,
        )
        const changed = samePublished
            ? changedReviewSourceIds((await this.reviewOf(tx, current)).reviewedSources, states).size > 0
            : changedSourceIds(recorded, states).size > 0
        if (samePublished && !changed) return { id: current.id, gapId: current.gapId, published: false }
        if (changed && request.reviewedChanges !== true) {
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.SourcesChanged })
        }
        const revision = samePublished ? current.draftRevision + 1 : current.draftRevision
        const approvedAt = this.clock.now()
        await tx.insert(PublicDocumentApprovalEntity, {
            documentId: current.id,
            workspaceId,
            draftRevision: revision,
            title: current.title,
            body: current.body,
            draftSources: [...recorded],
            reviewedSources: [...reviewedSourcesOf(recorded, states)],
            approvedBy: userId,
            approvedByName: approverName,
            approvedAt,
        })
        if (!samePublished) await this.publishIn(tx, userId, current)
        await tx.update(
            PublicDocumentEntity,
            { id: current.id, workspaceId },
            {
                status: "published",
                publishedBody: current.body,
                draftRevision: revision,
                publishedRevision: revision,
                publishedSourceId: current.id,
                approvedBy: userId,
                approvedByName: approverName,
                approvedAt,
                failureCode: null,
            },
        )
        await Promise.all(
            states.map((state) =>
                tx.update(
                    PublicDocumentSourceEntity,
                    { documentId: current.id, sourceId: state.id },
                    { sourceTitle: state.title, contentHash: state.contentHash ?? "" },
                ),
            ),
        )
        return { id: current.id, gapId: current.gapId, published: !samePublished }
    }

    /** The immutable source baseline of the exact published revision; a missing snapshot is a broken publication, never a replay. */
    private async reviewOf(manager: EntityManager, row: PublicDocumentEntity): Promise<PublicDocumentApprovalEntity> {
        const review = await manager.findOne(PublicDocumentApprovalEntity, {
            where: { workspaceId: row.workspaceId, documentId: row.id, draftRevision: row.draftRevision },
        })
        if (review === null) throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotFound })
        return review
    }

    /** Publishes a changed text through the source owner with the document transaction. Source-only review never reindexes the same text. */
    private async publishIn(manager: EntityManager, userId: string, row: PublicDocumentEntity): Promise<void> {
        const input = { title: row.title, content: row.body }
        const [live] = await this.sources.statesOf(row.workspaceId, [row.id], manager)
        if (live === undefined) await this.published.publish(row.workspaceId, userId, row.id, input, manager)
        else await this.published.replace(row.workspaceId, row.id, input, manager)
    }

    /** Takes the document down: customers read nothing of it from now on. It leaves the list and is kept. */
    async archive(userId: string, workspaceId: string, id: string): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.entityManager.transaction(async (tx) => {
            const row = await this.lockedRowOf(tx, workspaceId, id)
            await this.published.withdraw(workspaceId, row.id, tx)
            await tx.update(
                PublicDocumentEntity,
                { id: row.id, workspaceId },
                { status: "archived", publishedSourceId: null },
            )
        })
    }

    /** Serializes approval and withdrawal before either can change the public source of this document. */
    private async lockedRowOf(manager: EntityManager, workspaceId: string, id: string): Promise<PublicDocumentEntity> {
        const row = await manager.findOne(PublicDocumentEntity, {
            where: { id, workspaceId },
            lock: { mode: "pessimistic_write" },
        })
        if (row === null) throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotFound })
        return row
    }

    /** The internal documents of a draft request, each internal and fully read; any other is refused. */
    private async readySources(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<ReadySource>> {
        const unique = [...new Set(ids)]
        if (unique.length === 0) throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.SourcesRequired })
        if (unique.length > MAX_DRAFT_SOURCES) {
            throw new PublicDocumentsError({
                code: PublicDocumentsErrorCode.TooManySources,
                params: { max: MAX_DRAFT_SOURCES },
            })
        }
        const states = await this.sources.statesOf(workspaceId, unique)
        const ready = states.filter(
            (state): state is ReadySource =>
                state.visibility === "internal" && state.status === "ready" && state.contentHash !== null,
        )
        if (ready.length !== unique.length) {
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.SourceNotReady })
        }
        return ready
    }

    private async rowOf(workspaceId: string, id: string): Promise<PublicDocumentEntity> {
        const row = await this.entityManager.findOne(PublicDocumentEntity, { where: { id, workspaceId } })
        if (row === null) throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotFound })
        return row
    }

    private async viewOf(workspaceId: string, id: string): Promise<PublicDocumentView> {
        const [view] = await this.viewsOf(workspaceId, [await this.rowOf(workspaceId, id)])
        return view
    }

    private viewsOf(workspaceId: string, rows: readonly [PublicDocumentEntity]): Promise<readonly [PublicDocumentView]>
    private viewsOf(
        workspaceId: string,
        rows: ReadonlyArray<PublicDocumentEntity>,
    ): Promise<ReadonlyArray<PublicDocumentView>>
    private async viewsOf(
        workspaceId: string,
        rows: ReadonlyArray<PublicDocumentEntity>,
    ): Promise<ReadonlyArray<PublicDocumentView>> {
        if (rows.length === 0) return []
        const sources = await this.entityManager.find(PublicDocumentSourceEntity, {
            where: { workspaceId, documentId: In(rows.map((row) => row.id)) },
            order: { createdAt: "ASC", sourceTitle: "ASC" },
            take: SOURCE_ROWS_MAX,
        })
        const states = await this.sources.statesOf(workspaceId, [...new Set(sources.map((source) => source.sourceId))])
        const exact = rows.filter(
            (row) =>
                row.status === "published" &&
                row.publishedRevision !== null &&
                row.publishedRevision === row.draftRevision,
        )
        const reviews =
            exact.length === 0
                ? []
                : await this.entityManager.find(PublicDocumentApprovalEntity, {
                      where: exact.map((row) => ({
                          workspaceId,
                          documentId: row.id,
                          draftRevision: row.draftRevision,
                      })),
                      take: LIST_MAX,
                  })
        return rows.map((row) => {
            const review = reviews.find(
                (item) => item.documentId === row.id && item.draftRevision === row.draftRevision,
            )
            if (exact.includes(row) && review === undefined)
                throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotFound })
            return toPublicDocumentView(
                row,
                sources.filter((source) => source.documentId === row.id),
                review === undefined
                    ? changedFor(row.id, sources, states)
                    : changedReviewSourceIds(review.reviewedSources, states),
            )
        })
    }

    private async recordedOf(
        workspaceId: string,
        ids: ReadonlyArray<string>,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<SourceRecordRef>> {
        const rows = await manager.find(PublicDocumentSourceEntity, {
            where: { workspaceId, documentId: In([...ids]) },
            take: SOURCE_ROWS_MAX,
        })
        return rows.map((row) => ({ sourceId: row.sourceId, title: row.sourceTitle, contentHash: row.contentHash }))
    }

    private idOf(identifiers: ReadonlyArray<Record<string, unknown>>): string {
        const [identifier] = identifiers
        if (typeof identifier?.id !== "string")
            throw new PublicDocumentsError({ code: PublicDocumentsErrorCode.NotFound })
        return identifier.id
    }
}

/** The recorded sources of one document that changed, judged against the current state of the internal documents. */
const changedFor = (
    documentId: string,
    sources: ReadonlyArray<PublicDocumentSourceEntity>,
    states: ReadonlyArray<SourceState>,
): ReadonlySet<string> =>
    changedSourceIds(
        sources
            .filter((source) => source.documentId === documentId)
            .map((source) => ({
                sourceId: source.sourceId,
                title: source.sourceTitle,
                contentHash: source.contentHash,
            })),
        states,
    )
