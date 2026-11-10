import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KNOWLEDGE_UPLOAD_BUCKET, STORAGE_OBJECT_MISSING, WORKSPACE_SOURCE_BYTES } from "./knowledge-sources.contracts"
import type {
    FileReplacement,
    KnowledgeUsage,
    MaybeStoragePath,
    NewUpload,
    SourceKey,
} from "./knowledge-sources.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { replacementUpload } from "./source-input.policy"
import type { NormalizedSource } from "./source-input.policy"
import { quotaVerdict, rawBytesOf } from "./source-quota.policy"

@Injectable()
/** Holds a workspace to its raw document allowance: measures what a new source holds, admits it under a lock and says how much is used. */
export class SourceQuotaService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectKnowledgeStorage() private readonly storage: StorageObjectsPort,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** How much of its raw document allowance the workspace has used; any member may read it. */
    async usage(userId: string, workspaceId: string): Promise<KnowledgeUsage> {
        await this.members.require(userId, workspaceId)
        return { usedBytes: await this.usedBytes(this.entityManager, workspaceId), limitBytes: WORKSPACE_SOURCE_BYTES }
    }

    /** The raw bytes a new source holds: the size of the uploaded object of a file (one that was never uploaded is refused), the bytes of pasted text, nothing for a link. */
    async measure(source: NormalizedSource): Promise<number> {
        if (source.storagePath === null) return rawBytesOf(source, 0)
        return rawBytesOf(source, await this.uploadSize(source.storagePath))
    }

    /** The size of an uploaded object; one that was never uploaded is refused as missing. */
    async uploadSize(path: string): Promise<number> {
        const size = await this.storage.sizeOf(KNOWLEDGE_UPLOAD_BUCKET, path)
        if (size.kind === "ok") return size.value
        const code =
            size.code === STORAGE_OBJECT_MISSING
                ? KnowledgeSourcesErrorCode.UploadMissing
                : KnowledgeSourcesErrorCode.UploadUnavailable
        throw new KnowledgeSourcesError({ code })
    }

    /** A new upload of a file to read again, checked (inside the workspace, uploaded) with its size; null when none was given. */
    async uploadOf(workspaceId: string, path: string | undefined): Promise<NewUpload | null> {
        const checked = unwrapOutcome(replacementUpload(workspaceId, path), KnowledgeSourcesError)
        return checked === null ? null : { path: checked, bytes: await this.uploadSize(checked) }
    }

    /**
     * Inside the reindex transaction: whether a new upload may replace the file of a source, so the index job reads the new file and
     * re-embeds only the passages that changed (the partial re-read). The source must be a file, the new object must fit one document,
     * and only its growth is counted against the workspace's allowance, under the workspace's lock. Answers the columns to write (the
     * new object, its size and a cleared hash, so the job does not keep the text it knew) and the object it replaces; nothing for no upload.
     */
    async replacementOf(tx: EntityManager, target: SourceKey, upload: NewUpload | null): Promise<FileReplacement> {
        if (upload === null) return { columns: {}, replaced: null }
        const row = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true, kind: true, storagePath: true, sizeBytes: true },
            where: { id: target.sourceId, workspaceId: target.workspaceId },
        })
        if (row === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        if (row.kind !== "file") throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.NotAFile })
        unwrapOutcome(quotaVerdict(0, upload.bytes), KnowledgeSourcesError)
        await this.admit(tx, target.workspaceId, Math.max(0, upload.bytes - row.sizeBytes))
        return {
            columns: { storagePath: upload.path, sizeBytes: upload.bytes, contentHash: null },
            replaced: row.storagePath !== null && row.storagePath !== upload.path ? row.storagePath : null,
        }
    }

    /** Inside the writing transaction: takes the workspace's lock, so two adds cannot both pass, and refuses a source of `incoming` bytes that does not fit. */
    async admit(tx: EntityManager, workspaceId: string, incoming: number): Promise<void> {
        await advisoryXactLock(tx, `knowledge-sources:${workspaceId}`)
        unwrapOutcome(quotaVerdict(await this.usedBytes(tx, workspaceId), incoming), KnowledgeSourcesError)
    }

    /** Removes the uploaded object of a file the allowance refused, so it does not sit in storage unused; any other failure keeps it. */
    async discardRefused(path: MaybeStoragePath, failure: unknown): Promise<void> {
        const refusedBySize =
            failure instanceof KnowledgeSourcesError &&
            (failure.code === KnowledgeSourcesErrorCode.QuotaExceeded ||
                failure.code === KnowledgeSourcesErrorCode.FileTooLarge)
        if (path !== null && refusedBySize) await this.storage.remove(KNOWLEDGE_UPLOAD_BUCKET, [path])
    }

    /**
     * After a requeue is written: removes the object a new upload replaced (a storage failure only leaves it behind) and waits for the
     * announcement of the source.
     */
    async settleReplaced(replaced: string | null, announced: Promise<void>): Promise<void> {
        if (replaced !== null) await this.storage.remove(KNOWLEDGE_UPLOAD_BUCKET, [replaced]).catch(() => undefined)
        await announced
    }

    private async usedBytes(manager: EntityManager, workspaceId: string): Promise<number> {
        const row = await manager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .select("COALESCE(SUM(ks.sizeBytes), 0)", "used")
            .where("ks.workspaceId = :workspaceId", { workspaceId })
            .getRawOne<{ used: string }>()
        return Number(row?.used ?? 0)
    }
}
