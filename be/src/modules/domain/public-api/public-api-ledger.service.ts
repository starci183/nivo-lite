import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { returnedRows, rowShape } from "@modules/platform/database"
import type { RecordedRequest } from "./public-api.contracts"
import { PublicApiEntity } from "./persistence/entities"
import type { PublicApiKind } from "./persistence/entities"

/** What recording one request in the ledger needs. */
export interface LedgerRecord {
    /** The workspace of the key. */
    readonly workspaceId: string
    /** The key that sent the request. */
    readonly keyId: string
    /** The request kind. */
    readonly kind: PublicApiKind
    /** The dedupe prefix. */
    readonly prefix: string
    /** The dedupe suffix, empty for a fresh id. */
    readonly suffix: string
    /** The request body, stored as it is. */
    readonly body: object
}

/** The request a ledger statement returns: its row. */
const isRequestRow = rowShape({ id: "string" })

@Injectable()
/** The ledger of accepted public API requests, written only through the manager the caller's transaction hands in. */
export class PublicApiLedgerService {
    /**
     * Records one accepted request once per dedupe key; a repeat only counts. The dedupe key is the prefix and the suffix, or the
     * prefix and a fresh id when the suffix is empty. Answers the request and whether this call wrote the row.
     */
    async record(request: LedgerRecord, manager: EntityManager): Promise<RecordedRequest | undefined> {
        const written = await manager
            .createQueryBuilder(PublicApiEntity, "public_api")
            .insert()
            .values({
                workspaceId: request.workspaceId,
                keyId: request.keyId,
                kind: request.kind,
                dedupeKey: () => "(:prefix::text || COALESCE(NULLIF(:suffix::text, ''), gen_random_uuid()::text))",
                payload: request.body,
            })
            .setParameters({ prefix: request.prefix, suffix: request.suffix })
            .orIgnore()
            .returning("id")
            .execute()
        const [fresh] = returnedRows(written.raw, isRequestRow)
        if (fresh !== undefined) return { ...fresh, inserted: true }
        const counted = await manager
            .createQueryBuilder(PublicApiEntity, "p")
            .update()
            .set({ duplicates: () => "duplicates + 1" })
            .where({ workspaceId: request.workspaceId, dedupeKey: `${request.prefix}${request.suffix}` })
            .returning("id")
            .execute()
        const [earlier] = returnedRows(counted.raw, isRequestRow)
        return earlier === undefined ? undefined : { ...earlier, inserted: false }
    }

    /** Locks only the request belonging to this workspace, for the fenced worker that settles it. */
    lock(workspaceId: string, requestId: string, manager: EntityManager): Promise<PublicApiEntity | null> {
        return manager.findOne(PublicApiEntity, {
            where: { workspaceId, id: requestId },
            lock: { mode: "pessimistic_write" },
        })
    }

    /** Completes an admission only with its committed domain handoff. */
    async complete(workspaceId: string, requestId: string, manager: EntityManager): Promise<void> {
        await manager
            .createQueryBuilder(PublicApiEntity, "p")
            .update()
            .set({ processedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :requestId AND processed_at IS NULL", {
                workspaceId,
                requestId,
            })
            .execute()
    }
}
