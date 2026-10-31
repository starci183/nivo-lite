import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { ProgressChange } from "./knowledge-progress.contracts"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KNOWLEDGE_UPLOAD_BUCKET, STORAGE_OBJECT_MISSING } from "./knowledge-sources.contracts"
import type {
    AddSourceInput,
    DeletedSource,
    MaybeNote,
    MaybeSource,
    MaybeUploadedFile,
    ReindexInput,
    SourceBrief,
    SourceDetail,
    SourceRef,
    SourceStatus,
    SourceSummary,
    StoredNote,
    UpdateSourceInput,
    UploadAddress,
} from "./knowledge-sources.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { removedTitle } from "./persistence/knowledge-source.projection"
import {
    NOW,
    metaChanges,
    normalizeSource,
    normalizeUpdate,
    replacementContent,
    safeFileName,
} from "./source-input.policy"
import { SourceQuotaService } from "./source-quota.service"
import { toSourceDetail, toSourceRecord, toSourceSummary } from "./source-record.mapper"

/** The most documents the Knowledge page lists. */
const LIST_MAX = 500

/** The columns of a document the list shows: everything but the text. */
const SUMMARY_COLUMNS = {
    id: true,
    workspaceId: true,
    module: true,
    installationId: true,
    kind: true,
    topic: true,
    tags: true,
    visibility: true,
    title: true,
    status: true,
    error: true,
    chunkCount: true,
    sizeBytes: true,
    progress: true,
    stage: true,
    stageDone: true,
    stageTotal: true,
    createdAt: true,
    updatedAt: true,
} as const

/** The stage columns of a source no worker is on. */
const NO_STAGE = { stage: null, stageDone: null, stageTotal: null } as const

/** The statuses of a source no worker is on: only such a source is read again, so two jobs never embed the same passages. */
const IDLE_STATUSES: Array<SourceStatus> = ["pending", "ready", "failed", "blocked_credits"]

/** Who may change the knowledge of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** The documents of a workspace: adding, changing, retrying, re-reading and deleting them, and the stages a worker moves them through. */
export class KnowledgeSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectKnowledgeStorage() private readonly storage: StorageObjectsPort,
        private readonly members: WorkspaceMembersService,
        private readonly queue: KnowledgeQueue,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly entitlements: EntitlementsService,
        private readonly installations: InstallationRecordsService,
        private readonly quota: SourceQuotaService,
        private readonly progress: KnowledgeProgressService,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** The documents of a workspace, newest first and without their text; any member may read them. */
    async list(userId: string, workspaceId: string, module?: string): Promise<ReadonlyArray<SourceSummary>> {
        await this.members.require(userId, workspaceId)
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: SUMMARY_COLUMNS,
            where: module === undefined ? { workspaceId } : { workspaceId, module },
            order: { createdAt: "DESC" },
            take: LIST_MAX,
        })
        return rows.map(toSourceSummary)
    }

    /** One document of a workspace with its text; any member may read it. */
    async detail(userId: string, workspaceId: string, sourceId: string): Promise<SourceDetail> {
        await this.members.require(userId, workspaceId)
        const row = await this.entityManager.findOne(KnowledgeSourceEntity, {
            select: { ...SUMMARY_COLUMNS, content: true },
            where: { workspaceId, id: sourceId },
        })
        if (row === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        return toSourceDetail(row)
    }

    /** Adds a document and queues its indexing; the row and the job are written in one transaction, after the workspace's raw-data allowance is checked under a lock. */
    async addSource(userId: string, workspaceId: string, input: AddSourceInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const source = unwrapOutcome(normalizeSource(workspaceId, input), KnowledgeSourcesError)
        const instance = await this.instanceOf(workspaceId, source.installationId)
        const sizeBytes = await this.quota.measure(source)
        try {
            const ref = await this.entityManager.transaction(async (tx) => {
                const stored = await this.storedUpload(tx, workspaceId, source.storagePath)
                if (stored !== null) return stored
                await this.quota.admit(tx, workspaceId, sizeBytes)
                const inserted = await tx.insert(KnowledgeSourceEntity, {
                    workspaceId,
                    module: instance?.moduleKey ?? source.module,
                    installationId: instance?.id ?? null,
                    kind: source.kind,
                    topic: source.topic,
                    tags: [...source.tags],
                    visibility: source.visibility,
                    title: source.title,
                    content: source.content,
                    status: "queued",
                    progress: 0,
                    storagePath: source.storagePath,
                    sourceUrl: source.sourceUrl,
                    origin: source.origin,
                    sizeBytes,
                    createdBy: userId,
                })
                const [row] = inserted.identifiers
                if (typeof row?.id !== "string")
                    throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
                await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
                return { id: row.id }
            })
            await this.progress.announce(workspaceId, ref.id)
            return ref
        } catch (failure) {
            await this.quota.discardRefused(source.storagePath, failure)
            throw failure
        }
    }

    /** Puts a failed or credit-blocked source back on the queue; any other source is left as it is. */
    async retrySource(userId: string, workspaceId: string, sourceId: string): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const queued = await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId, status: In(["failed", "blocked_credits"]) },
                { status: "queued", progress: 0, error: null, ...NO_STAGE, updatedAt: NOW },
            )
            if (requeued.affected === 0) return false
            await this.queue.enqueueIndex({ sourceId, workspaceId }, tx, this.clock.now().getTime())
            return true
        })
        if (queued) await this.progress.announce(workspaceId, sourceId)
        return { id: sourceId }
    }

    /** Reads a source again, optionally with new text. */
    async reindexSource(userId: string, workspaceId: string, input: ReindexInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const content = unwrapOutcome(replacementContent(input.content), KnowledgeSourcesError)
        const queued = await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.update(
                KnowledgeSourceEntity,
                { id: input.sourceId, workspaceId, status: In(IDLE_STATUSES) },
                {
                    status: "queued",
                    progress: 0,
                    error: null,
                    ...NO_STAGE,
                    ...(content === null ? {} : { content }),
                    updatedAt: NOW,
                },
            )
            if (requeued.affected === 0) {
                const busy = await tx.findOne(KnowledgeSourceEntity, {
                    select: { id: true },
                    where: { id: input.sourceId, workspaceId },
                })
                if (busy === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
                return false
            }
            await this.queue.enqueueIndex({ sourceId: input.sourceId, workspaceId }, tx, this.clock.now().getTime())
            return true
        })
        if (queued) await this.progress.announce(workspaceId, input.sourceId)
        return { id: input.sourceId }
    }

    /** Changes the metadata of a source; the database moves its passages to the new module and visibility. */
    async updateSource(userId: string, workspaceId: string, input: UpdateSourceInput): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const change = normalizeUpdate(input)
        const changed = await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: input.sourceId, workspaceId },
            metaChanges(change),
        )
        if (changed.affected === 0) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
    }

    /** Deletes a source with its passages; answers its title so the brain can note what it withdraws. */
    async removeSource(userId: string, workspaceId: string, sourceId: string): Promise<DeletedSource> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const removed = await this.entityManager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .delete()
            .where({ id: sourceId, workspaceId })
            .returning("title")
            .execute()
        const title = removedTitle(removed.raw)
        if (title === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        return { title }
    }

    /** An address a browser uploads one document to: `<workspaceId>/<uuid>/<filename>` in the private bucket. */
    async createUpload(userId: string, workspaceId: string, filename: string): Promise<UploadAddress> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (filename.trim() === "")
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.FileNameRequired })
        await this.entitlements.requireStorageFor(workspaceId, 0)
        const path = `${workspaceId}/${this.ids.next()}/${safeFileName(filename)}`
        const signed = await this.storage.signedUpload(KNOWLEDGE_UPLOAD_BUCKET, path)
        if (signed.kind === "refused") {
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.UploadUnavailable })
        }
        return { path: signed.value.path, token: signed.value.token, signedUrl: signed.value.signedUrl }
    }

    /** Queues the re-embedding of the workspace's stale passages with `model`. */
    async requestReembed(userId: string, workspaceId: string, model: string): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.entityManager.transaction((tx) => this.queue.enqueueReembed({ workspaceId, model }, tx))
    }

    /** Queues the follow-up of a re-embedding job that reached its batch limit. */
    async continueReembed(workspaceId: string, model: string): Promise<void> {
        await this.entityManager.transaction((tx) =>
            this.queue.enqueueReembed({ workspaceId, model }, tx, this.clock.now().getTime()),
        )
    }

    /** A source of a workspace as the jobs read it; null when it is gone. */
    async sourceOf(workspaceId: string, sourceId: string): Promise<MaybeSource> {
        const row = await this.entityManager.findOne(KnowledgeSourceEntity, { where: { id: sourceId, workspaceId } })
        return row === null ? null : toSourceRecord(row)
    }

    /** The kind, title and topic of these sources of a workspace, for the passages a search found; an unknown id is left out. */
    async briefsOf(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyArray<SourceBrief>> {
        if (sourceIds.length === 0) return []
        const rows = await this.entityManager.find(KnowledgeSourceEntity, {
            select: { id: true, kind: true, title: true, topic: true },
            where: { workspaceId, id: In([...sourceIds]) },
            take: sourceIds.length,
        })
        return rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title, topic: row.topic }))
    }

    /** The bytes of an uploaded document; null when the object is not in storage. Any other storage failure is thrown for the queue to retry. */
    async readUpload(path: string): Promise<MaybeUploadedFile> {
        const stored = await this.storage.download(KNOWLEDGE_UPLOAD_BUCKET, path)
        if (stored.kind === "ok") return { bytes: stored.value.bytes, contentType: stored.value.contentType }
        if (stored.code === STORAGE_OBJECT_MISSING) return null
        throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.UploadUnavailable })
    }

    /** The worker starts reading the source. */
    begin(workspaceId: string, sourceId: string): Promise<void> {
        return this.progress.write(workspaceId, sourceId, {
            status: "reading",
            error: null,
            progress: 5,
            stage: "read",
            done: null,
            total: null,
        })
    }

    /** The text of the source is known: it is stored with its title and the source moves to indexing, at the stage of cutting it into passages. */
    async startIndexing(workspaceId: string, sourceId: string, content: string, title: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            {
                status: "indexing",
                content,
                title,
                progress: 20,
                stage: "chunk",
                stageDone: null,
                stageTotal: null,
                updatedAt: NOW,
            },
        )
        await this.progress.announce(workspaceId, sourceId)
    }

    /** Moves the stage, count and progress bar of a source, at most about once a second; never fails the job. */
    advance(workspaceId: string, sourceId: string, change: ProgressChange): Promise<void> {
        return this.progress.count(workspaceId, sourceId, change)
    }

    /** Moves the source to a stage at once: a change of stage is never held back by the throttle. */
    enterStage(workspaceId: string, sourceId: string, change: ProgressChange): Promise<void> {
        return this.progress.write(workspaceId, sourceId, change)
    }

    /** Closes a source as failed with the stored code the front end shows its own text for. */
    fail(workspaceId: string, sourceId: string, note: string): Promise<void> {
        return this.progress.write(workspaceId, sourceId, {
            status: "failed",
            error: note,
            stage: null,
            done: null,
            total: null,
        })
    }

    /** The passages are stored: the source records them and a note, and `knowledge_source_indexed` is published with the move to that stage in one transaction. */
    async finishIndexing(workspaceId: string, sourceId: string, note: MaybeNote, chunks: number): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId },
                { error: note, chunkCount: chunks, progress: 80, updatedAt: NOW },
            )
            const indexed = KnowledgeSourceIndexedEvent.create({
                sourceId,
                workspaceId,
                indexedAt: this.clock.now().getTime(),
            })
            await this.bus.publish(indexed, tx, indexed.eventId)
            await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId },
                {
                    status: "extracting_facts",
                    progress: 85,
                    stage: "facts",
                    stageDone: null,
                    stageTotal: null,
                    updatedAt: NOW,
                },
            )
        })
        await this.progress.announce(workspaceId, sourceId)
    }

    /** The passages are stored without vectors and the source waits for credits. */
    blockIndexing(workspaceId: string, sourceId: string, note: StoredNote, chunks: number): Promise<void> {
        return this.progress.write(workspaceId, sourceId, {
            status: "blocked_credits",
            error: note,
            chunkCount: chunks,
            progress: 80,
            stage: null,
            done: null,
            total: null,
        })
    }

    /** The facts are read (or could not be): the source is ready, with a stored note when the reading failed. */
    ready(workspaceId: string, sourceId: string, note: MaybeNote): Promise<void> {
        return this.progress.write(workspaceId, sourceId, {
            status: "ready",
            progress: 100,
            stage: null,
            done: null,
            total: null,
            ...(note === null ? {} : { error: note }),
        })
    }

    /** The facts cannot be read because the workspace has no credits left: the source waits for them. */
    blockFacts(workspaceId: string, sourceId: string, note: StoredNote): Promise<void> {
        return this.progress.write(workspaceId, sourceId, {
            status: "blocked_credits",
            error: note,
            stage: null,
            done: null,
            total: null,
        })
    }

    /** The source an uploaded object already became, so a repeated add (a lost response, a retry) never makes a second one; null for a new object or a source with no file. */
    private async storedUpload(tx: EntityManager, workspaceId: string, path: string | null): Promise<SourceRef | null> {
        if (path === null) return null
        const found = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true },
            where: { workspaceId, storagePath: path },
        })
        return found === null ? null : { id: found.id }
    }

    /** The agent instance a document is kept for, which must belong to the workspace; null when the document is for every instance. */
    private async instanceOf(workspaceId: string, installationId: string | null): Promise<InstallationRecord | null> {
        if (installationId === null) return null
        const found = await this.installations.find(workspaceId, installationId)
        if (found === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.InstanceUnknown })
        return found
    }
}
