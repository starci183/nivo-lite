import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { unwrapOutcome } from "@modules/platform/primitives"
import type { SupabaseStoragePort } from "@modules/integrations/supabase"
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
    SourceRef,
    StoredNote,
    UpdateSourceInput,
    UploadAddress,
} from "./knowledge-sources.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import type { KnowledgeSourcesRow } from "./persistence/knowledge-sources.rows"
import type { GeneratedIdRow, InstallationRow, SourceIdRow, SourceTitleRow } from "./persistence/knowledge-sources.rows"
import {
    DELETE_SOURCE,
    INSERT_SOURCE,
    MARK_BLOCKED,
    MARK_EXTRACTING,
    MARK_FACTS_BLOCKED,
    MARK_FAILED,
    MARK_INDEXED,
    MARK_INDEXING,
    MARK_READING,
    MARK_READY,
    REQUEUE_FAILED_SOURCE,
    REQUEUE_SOURCE,
    SELECT_INSTALLATION,
    SELECT_NEW_ID,
    SELECT_SOURCE,
    SET_PROGRESS,
    UPDATE_SOURCE_META,
} from "./persistence/knowledge-sources.sql"
import { normalizeSource, normalizeUpdate, replacementContent, safeFileName } from "./source-input.policy"
import { toSourceRecord } from "./source-record.mapper"

/** Who may change the knowledge of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** The documents of a workspace: adding, changing, retrying, re-reading and deleting them, and the stages a worker moves them through. */
export class KnowledgeSourcesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectKnowledgeStorage() private readonly storage: SupabaseStoragePort,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** Adds a document and queues its indexing; the row and the job are written in one transaction. */
    async addSource(userId: string, workspaceId: string, input: AddSourceInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const source = unwrapOutcome(normalizeSource(workspaceId, input), KnowledgeSourcesError)
        const instance = await this.instanceOf(workspaceId, source.installationId)
        return this.entityManager.transaction(async (tx) => {
            const [row] = await tx.query<Array<SourceIdRow>>(INSERT_SOURCE, [
                workspaceId,
                instance?.module_key ?? source.module,
                instance?.id ?? null,
                source.kind,
                source.topic,
                [...source.tags],
                source.visibility,
                source.title,
                source.content,
                source.storagePath,
                source.sourceUrl,
                source.origin,
                userId,
            ])
            if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
            await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
            return { id: row.id }
        })
    }

    /** Puts a failed or credit-blocked source back on the queue; any other source is left as it is. */
    async retrySource(userId: string, workspaceId: string, sourceId: string): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.query<Array<SourceIdRow>>(REQUEUE_FAILED_SOURCE, [sourceId, workspaceId])
            if (requeued.length === 0) return
            await this.queue.enqueueIndex({ sourceId, workspaceId }, tx, this.clock.now().getTime())
        })
        return { id: sourceId }
    }

    /** Reads a source again, optionally with new text. */
    async reindexSource(userId: string, workspaceId: string, input: ReindexInput): Promise<SourceRef> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const content = unwrapOutcome(replacementContent(input.content), KnowledgeSourcesError)
        await this.entityManager.transaction(async (tx) => {
            const requeued = await tx.query<Array<SourceIdRow>>(REQUEUE_SOURCE, [input.sourceId, workspaceId, content])
            if (requeued.length === 0)
                throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
            await this.queue.enqueueIndex({ sourceId: input.sourceId, workspaceId }, tx, this.clock.now().getTime())
        })
        return { id: input.sourceId }
    }

    /** Changes the metadata of a source; the database moves its passages to the new module and visibility. */
    async updateSource(userId: string, workspaceId: string, input: UpdateSourceInput): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const change = normalizeUpdate(input)
        const changed = await this.entityManager.query<Array<SourceIdRow>>(UPDATE_SOURCE_META, [
            input.sourceId,
            workspaceId,
            change.title,
            change.topic,
            change.tags === null ? null : [...change.tags],
            change.module,
            change.visibility,
        ])
        if (changed.length === 0) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
    }

    /** Deletes a source with its passages; answers its title so the brain can note what it withdraws. */
    async removeSource(userId: string, workspaceId: string, sourceId: string): Promise<DeletedSource> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const [row] = await this.entityManager.query<Array<SourceTitleRow>>(DELETE_SOURCE, [sourceId, workspaceId])
        if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        return { title: row.title }
    }

    /** An address a browser uploads one document to: `<workspaceId>/<uuid>/<filename>` in the private bucket. */
    async createUpload(userId: string, workspaceId: string, filename: string): Promise<UploadAddress> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (filename.trim() === "")
            throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.FileNameRequired })
        const ids = await this.entityManager.query<Array<GeneratedIdRow>>(SELECT_NEW_ID)
        const path = ids.map((row) => `${workspaceId}/${row.id}/${safeFileName(filename)}`).join("")
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
        const [row] = await this.entityManager.query<Array<KnowledgeSourcesRow>>(SELECT_SOURCE, [sourceId, workspaceId])
        return row === undefined ? null : toSourceRecord(row)
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
        await this.entityManager.query(MARK_READING, [sourceId, workspaceId])
    }

    /** The text of the source is known: it is stored with its title and the source moves to indexing. */
    async startIndexing(workspaceId: string, sourceId: string, content: string, title: string): Promise<void> {
        await this.entityManager.query(MARK_INDEXING, [sourceId, workspaceId, content, title])
    }

    /** Moves the progress bar of a source; never fails the job. */
    async advance(workspaceId: string, sourceId: string, percent: number): Promise<void> {
        const clamped = Math.max(0, Math.min(100, Math.round(percent)))
        await this.entityManager.query(SET_PROGRESS, [sourceId, workspaceId, clamped]).catch((cause: unknown) => {
            this.logger.error(KnowledgeSourcesLogEvent.ProgressFailed, cause, { sourceId })
        })
    }

    /** Closes a source as failed with the stored code the front end shows its own text for. */
    async fail(workspaceId: string, sourceId: string, note: string): Promise<void> {
        await this.entityManager.query(MARK_FAILED, [sourceId, workspaceId, note])
    }

    /** The passages are stored: the source records them and a note, and the facts job is queued with the move to that stage in one transaction. */
    async finishIndexing(workspaceId: string, sourceId: string, note: MaybeNote, chunks: number): Promise<void> {
        await this.entityManager.transaction(async (tx) => {
            await tx.query(MARK_INDEXED, [sourceId, workspaceId, note, chunks])
            await this.queue.enqueueFacts({ sourceId, workspaceId }, tx, this.clock.now().getTime())
            await tx.query(MARK_EXTRACTING, [sourceId, workspaceId])
        })
    }

    /** The passages are stored without vectors and the source waits for credits. */
    async blockIndexing(workspaceId: string, sourceId: string, note: StoredNote, chunks: number): Promise<void> {
        await this.entityManager.query(MARK_BLOCKED, [sourceId, workspaceId, note, chunks])
    }

    /** The facts are read (or could not be): the source is ready, with a stored note when the reading failed. */
    async ready(workspaceId: string, sourceId: string, note: MaybeNote): Promise<void> {
        await this.entityManager.query(MARK_READY, [sourceId, workspaceId, note])
    }

    /** The facts cannot be read because the workspace has no credits left: the source waits for them. */
    async blockFacts(workspaceId: string, sourceId: string, note: StoredNote): Promise<void> {
        await this.entityManager.query(MARK_FACTS_BLOCKED, [sourceId, workspaceId, note])
    }

    /** The agent instance a document is kept for, which must belong to the workspace; null when the document is for every instance. */
    private async instanceOf(workspaceId: string, installationId: string | null): Promise<InstallationRow | null> {
        if (installationId === null) return null
        const [row] = await this.entityManager.query<Array<InstallationRow>>(SELECT_INSTALLATION, [
            workspaceId,
            installationId,
        ])
        if (row === undefined) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.InstanceUnknown })
        return row
    }
}
