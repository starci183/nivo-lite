import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { unwrapOutcome } from "@modules/platform/primitives"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import {
    BRAIN_DOCUMENTS_BYTES,
    KNOWLEDGE_UPLOAD_BUCKET,
    STORAGE_OBJECT_MISSING,
    type DocumentVisibility,
    type FileReplacement,
    type MaybeNewUpload,
    type MaybeStoragePath,
    type OptionalSizeBytes,
    type OptionalUploadPath,
    type SourceKey,
} from "./knowledge-sources.contracts"
import {
    DOCUMENT_AREAS,
    type AreaHeld,
    type AreasUsage,
    type OptionalArea,
    type KnowledgeUsage,
} from "./source-areas.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { replacementUpload, type NormalizedSource } from "./source-input.policy"
import { areaVerdict, areasUsageOf, quotaVerdict, rawBytesOf } from "./source-quota.policy"

/** The refusals of a document that does not fit: one too large, the workspace full, or its area full. */
const SIZE_REFUSALS: ReadonlySet<KnowledgeSourcesErrorCode> = new Set([
    KnowledgeSourcesErrorCode.QuotaExceeded,
    KnowledgeSourcesErrorCode.FileTooLarge,
    KnowledgeSourcesErrorCode.PublicAreaFull,
    KnowledgeSourcesErrorCode.InternalAreaFull,
])

/** What the workspace's documents hold: in total and in each area. */
interface Held {
    /** The raw bytes of every document. */
    readonly used: number
    /** The documents (a long file cut into parts counts once). */
    readonly count: number
    /** The same per area. */
    readonly areas: AreasUsage
}

/** One row of the aggregate per area. */
interface HeldRow {
    readonly visibility: string
    readonly used: string
    readonly documents?: string
}

/** The area a stored visibility is: public, else internal (a document no area names is the team's). */
const areaOfRow = (visibility: string): DocumentVisibility => (visibility === "public" ? "public" : "internal")

@Injectable()
/**
 * Holds a workspace to the Second Brain's documents limits, the same for every workspace: each of the two upload areas (public,
 * internal) holds at most `BRAIN_AREA_BYTES` (5 MB) of source bytes and the workspace at most `BRAIN_DOCUMENTS_BYTES` (10 MB) (owner
 * 2026-11-12); the plan's general storage is `EntitlementsService.requireStorageFor`'s, never this: measures what a new source holds,
 * admits it into its area under the workspace's lock (an upload, a file replacement's growth, a document moved in) and says how much
 * is used.
 */
export class SourceQuotaService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectKnowledgeStorage() private readonly storage: StorageObjectsPort,
        private readonly members: WorkspaceMembersService,
        private readonly entitlements: EntitlementsService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** How much of its raw document allowance the workspace has used; any member may read it. */
    async usage(userId: string, workspaceId: string): Promise<KnowledgeUsage> {
        await this.members.require(userId, workspaceId)
        const held = await this.held(this.entityManager, workspaceId)
        return { usedBytes: held.used, limitBytes: BRAIN_DOCUMENTS_BYTES, count: held.count, areas: held.areas }
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
    async uploadOf(workspaceId: string, path: OptionalUploadPath): Promise<MaybeNewUpload> {
        const checked = unwrapOutcome(replacementUpload(workspaceId, path), KnowledgeSourcesError)
        return checked === null ? null : { path: checked, bytes: await this.uploadSize(checked) }
    }

    /**
     * Inside the reindex transaction: whether a new upload may replace the file of a source, so the index job reads the new file and
     * re-embeds only the passages that changed (the partial re-read). The source must be a file, the new object must fit one document,
     * and only its growth is counted against the workspace's allowance, under the workspace's lock. Answers the columns to write (the
     * new object, its size and a cleared hash, so the job does not keep the text it knew) and the object it replaces; nothing for no upload.
     */
    async replacementOf(tx: EntityManager, target: SourceKey, upload: MaybeNewUpload): Promise<FileReplacement> {
        if (upload === null) return { columns: {}, replaced: null }
        const row = await tx.findOne(KnowledgeSourceEntity, {
            select: { id: true, kind: true, storagePath: true, sizeBytes: true, visibility: true },
            where: { id: target.sourceId, workspaceId: target.workspaceId },
        })
        if (row === null) throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.SourceNotFound })
        if (row.kind !== "file") throw new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.NotAFile })
        unwrapOutcome(quotaVerdict(0, upload.bytes), KnowledgeSourcesError)
        await this.admit(tx, target.workspaceId, Math.max(0, upload.bytes - row.sizeBytes), areaOfRow(row.visibility))
        return {
            columns: { storagePath: upload.path, sizeBytes: upload.bytes, contentHash: null },
            replaced: row.storagePath !== null && row.storagePath !== upload.path ? row.storagePath : null,
        }
    }

    /**
     * The two checks of a Second Brain upload before its address is signed, in order: the PLAN's general storage
     * (`EntitlementsService.requireStorageFor` over every stored object of the workspace, its own error, unchanged), then, when the
     * browser said the size, the Second Brain's limits (`precheck`: the area's when the page names the area, else the workspace's).
     * Adding the source checks them again under the lock (`admit`).
     */
    async beforeUpload(
        workspaceId: string,
        sizeBytes: OptionalSizeBytes,
        area: OptionalArea = undefined,
    ): Promise<void> {
        await this.entitlements.requireStorageFor(workspaceId, sizeBytes ?? 0)
        if (sizeBytes !== undefined) await this.precheck(workspaceId, sizeBytes, area)
    }

    /**
     * Before an upload starts: refuses a file of `incoming` bytes that does not fit what its area has left (the area's refusal, params
     * `area`, `fileBytes`, `usedBytes`, `leftBytes`, `limitBytes`), or, when no area is named, what the workspace has left
     * (`KNOWLEDGE_SOURCES_QUOTA_EXCEEDED`, the same params). No lock: it only spares the upload; `admit` decides.
     */
    async precheck(workspaceId: string, incoming: number, area: OptionalArea = undefined): Promise<void> {
        const held = await this.held(this.entityManager, workspaceId)
        const verdict =
            area === undefined
                ? quotaVerdict(held.used, incoming, BRAIN_DOCUMENTS_BYTES)
                : areaVerdict(held.areas, area, incoming)
        unwrapOutcome(verdict, KnowledgeSourcesError)
    }

    /**
     * Inside the writing transaction: takes the workspace's lock, so two adds cannot both pass, and refuses a source of `incoming` bytes
     * that does not fit its `area` (with that area's numbers) or the workspace.
     */
    async admit(tx: EntityManager, workspaceId: string, incoming: number, area: DocumentVisibility): Promise<void> {
        await advisoryXactLock(tx, `knowledge-sources:${workspaceId}`)
        unwrapOutcome(areaVerdict((await this.held(tx, workspaceId)).areas, area, incoming), KnowledgeSourcesError)
    }

    /**
     * Inside the MOVE's transaction, before the area is written: the bytes of the document (its first source and every later part) are
     * admitted into the area it moves to, under the workspace's lock, with that area's numbers; a source already in that area is not
     * counted again.
     */
    async admitMove(
        tx: EntityManager,
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        to: DocumentVisibility,
    ): Promise<void> {
        await advisoryXactLock(tx, `knowledge-sources:${workspaceId}`)
        const rows = await tx.find(KnowledgeSourceEntity, {
            select: { id: true, sizeBytes: true, visibility: true },
            where: { workspaceId, id: In([...sourceIds]) },
            take: sourceIds.length,
        })
        const incoming = rows.filter((row) => row.visibility !== to).reduce((sum, row) => sum + row.sizeBytes, 0)
        if (incoming === 0) return
        unwrapOutcome(areaVerdict((await this.held(tx, workspaceId)).areas, to, incoming), KnowledgeSourcesError)
    }

    /** Removes the uploaded object of a file the allowance refused, so it does not sit in storage unused; any other failure keeps it. */
    async discardRefused(path: MaybeStoragePath, failure: unknown): Promise<void> {
        const refusedBySize = failure instanceof KnowledgeSourcesError && SIZE_REFUSALS.has(failure.code)
        if (path !== null && refusedBySize) await this.storage.remove(KNOWLEDGE_UPLOAD_BUCKET, [path])
    }

    /**
     * After a requeue is written: removes the object a new upload replaced (a storage failure only leaves it behind) and waits for the
     * announcement of the source.
     */
    async settleReplaced(replaced: MaybeStoragePath, announced: Promise<void>): Promise<void> {
        if (replaced !== null) {
            await this.storage.remove(KNOWLEDGE_UPLOAD_BUCKET, [replaced]).catch((cause: unknown) => {
                this.logger.error(KnowledgeSourcesLogEvent.ReplacedObjectKept, cause, { path: replaced })
            })
        }
        await announced
    }

    /**
     * The raw bytes the workspace's documents hold and how many documents they are, per area, in ONE aggregate over its sources grouped
     * by `visibility` (an indexed read by workspace, bounded by the 10 MB limit: a few hundred rows). A later part of a long file
     * (`origin` `part:<first id>`) is not a document of its own.
     */
    private async held(manager: EntityManager, workspaceId: string): Promise<Held> {
        const rows = await manager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .select("ks.visibility", "visibility")
            .addSelect("COALESCE(SUM(ks.sizeBytes), 0)", "used")
            .addSelect("COUNT(*) FILTER (WHERE ks.origin IS NULL OR ks.origin NOT LIKE 'part:%')", "documents")
            .where("ks.workspaceId = :workspaceId", { workspaceId })
            .groupBy("ks.visibility")
            .getRawMany<HeldRow>()
        const of = (area: DocumentVisibility): AreaHeld => {
            const mine = rows.filter((row) => areaOfRow(row.visibility) === area)
            return {
                used: mine.reduce((sum, row) => sum + Number(row.used), 0),
                count: mine.reduce((sum, row) => sum + Number(row.documents ?? 0), 0),
            }
        }
        const areas = areasUsageOf({ public: of("public"), internal: of("internal") })
        return {
            used: DOCUMENT_AREAS.reduce((sum, area) => sum + areas[area].usedBytes, 0),
            count: DOCUMENT_AREAS.reduce((sum, area) => sum + areas[area].count, 0),
            areas,
        }
    }
}
