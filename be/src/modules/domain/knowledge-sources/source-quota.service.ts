import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { unwrapOutcome } from "@modules/platform/primitives"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KNOWLEDGE_UPLOAD_BUCKET, STORAGE_OBJECT_MISSING, WORKSPACE_SOURCE_BYTES } from "./knowledge-sources.contracts"
import type { KnowledgeUsage, MaybeStoragePath } from "./knowledge-sources.contracts"
import { InjectKnowledgeStorage } from "./knowledge-sources.decorators"
import { KnowledgeSourceEntity } from "./persistence/entities"
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
        const size = await this.storage.sizeOf(KNOWLEDGE_UPLOAD_BUCKET, source.storagePath)
        if (size.kind === "ok") return rawBytesOf(source, size.value)
        const code =
            size.code === STORAGE_OBJECT_MISSING
                ? KnowledgeSourcesErrorCode.UploadMissing
                : KnowledgeSourcesErrorCode.UploadUnavailable
        throw new KnowledgeSourcesError({ code })
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

    private async usedBytes(manager: EntityManager, workspaceId: string): Promise<number> {
        const row = await manager
            .createQueryBuilder(KnowledgeSourceEntity, "ks")
            .select("COALESCE(SUM(ks.sizeBytes), 0)", "used")
            .where("ks.workspaceId = :workspaceId", { workspaceId })
            .getRawOne<{ used: string }>()
        return Number(row?.used ?? 0)
    }
}
