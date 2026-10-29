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
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
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
    SourceSummary,
    StoredNote,
    UpdateSourceInput,
    UploadAddress,
} from "./knowledge-sources.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
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
    progress: true,
    createdAt: true,
    updatedAt: true,
} as const

/** Who may change the knowledge of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** The documents of a workspace: adding, changing, retrying, re-reading and deleting them, and the stages a worker moves them through. */
export class KnowledgeSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectKnowledgeStorage() private readonly storage: StorageObjectsPort,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly queue: KnowledgeQueue,
        @InjectEventBus() private readonly bus: EventBus,
        private readonly entitlements: EntitlementsService,
        private readonly installations: InstallationRecordsService,
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

    /** Adds a document and queues its indexing; the row and the job are written in one transaction. */
    async addSource(userId: string, workspaceId: string, input: AddSourceInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const source = unwrapOutcome(normalizeSource(workspaceId, input), KnowledgeSourcesError)
        const instance = await this.instanceOf(workspaceId, source.installationId)
        return this.entityManager.transaction(async (tx) => {
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
                createdBy: userId,
            })
            const [row] = inserted.identifiers
            if (typeof row?.id !== "string")
                throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
            await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
            return { id: row.id }
        })
    }

    /** Puts a failed or credit-blocked source back on the queue; any other source is left as it is. */
    async retrySource(userId: string, workspaceId: string, sourceId: string): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId, status: In(["failed", "blocked_credits"]) },
                { status: "queued", progress: 0, error: null, updatedAt: NOW },
            )
            if (requeued.affected === 0) return
            await this.queue.enqueueIndex({ sourceId, workspaceId }, tx, this.clock.now().getTime())
        })
        return { id: sourceId }
    }

    /** Reads a source again, optionally with new text. */
    async reindexSource(userId: string, workspaceId: string, input: ReindexInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const content = unwrapOutcome(replacementContent(input.content), KnowledgeSourcesError)
        await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.update(
                KnowledgeSourceEntity,
                { id: input.sourceId, workspaceId },
                {
                    status: "queued",
                    progress: 0,
                    error: null,
                    ...(content === null ? {} : { content }),
                    updatedAt: NOW,
                },
            )
            if (requeued.affected === 0)
                throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
            await this.queue.enqueueIndex({ sourceId: input.sourceId, workspaceId }, tx, this.clock.now().getTime())
        })
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
    async begin(workspaceId: string, sourceId: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "reading", error: null, progress: 5, updatedAt: NOW },
        )
    }

    /** The text of the source is known: it is stored with its title and the source moves to indexing. */
    async startIndexing(workspaceId: string, sourceId: string, content: string, title: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "indexing", content, title, progress: 20, updatedAt: NOW },
        )
    }

    /** Moves the progress bar of a source; never fails the job. */
    async advance(workspaceId: string, sourceId: string, percent: number): Promise<void> {
        const clamped = Math.max(0, Math.min(100, Math.round(percent)))
        await this.entityManager
            .update(KnowledgeSourceEntity, { id: sourceId, workspaceId }, { progress: clamped, updatedAt: NOW })
            .catch((cause: unknown) => {
                this.logger.error(KnowledgeSourcesLogEvent.ProgressFailed, cause, { sourceId })
            })
    }

    /** Closes a source as failed with the stored code the front end shows its own text for. */
    async fail(workspaceId: string, sourceId: string, note: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "failed", error: note, updatedAt: NOW },
        )
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
                { status: "extracting_facts", progress: 85, updatedAt: NOW },
            )
        })
    }

    /** The passages are stored without vectors and the source waits for credits. */
    async blockIndexing(workspaceId: string, sourceId: string, note: StoredNote, chunks: number): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "blocked_credits", error: note, chunkCount: chunks, progress: 80, updatedAt: NOW },
        )
    }

    /** The facts are read (or could not be): the source is ready, with a stored note when the reading failed. */
    async ready(workspaceId: string, sourceId: string, note: MaybeNote): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "ready", progress: 100, ...(note === null ? {} : { error: note }), updatedAt: NOW },
        )
    }

    /** The facts cannot be read because the workspace has no credits left: the source waits for them. */
    async blockFacts(workspaceId: string, sourceId: string, note: StoredNote): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { status: "blocked_credits", error: note, updatedAt: NOW },
        )
    }

    /** The agent instance a document is kept for, which must belong to the workspace; null when the document is for every instance. */
    private async instanceOf(workspaceId: string, installationId: string | null): Promise<InstallationRecord | null> {
        if (installationId === null) return null
        const found = await this.installations.find(workspaceId, installationId)
        if (found === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.InstanceUnknown })
        return found
    }
}
