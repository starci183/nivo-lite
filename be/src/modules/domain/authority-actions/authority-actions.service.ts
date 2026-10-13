import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AuthorityActionRecord, AuthorityActionsSyncReport } from "./authority-actions.contracts"
import type { AuthorityActionsRow } from "./persistence/authority-actions.rows"
import { LIST_ACTION_KEYS, LIST_AUTHORITY_ACTIONS, UPSERT_AUTHORITY_ACTIONS } from "./persistence/authority-actions.sql"

@Injectable()
/** The authority action rows, written through the transaction the catalogue sync hands in. */
export class AuthorityActionsService {
    /** Upserts the records in the caller's transaction and reports the rows it did not write; nothing is deleted. */
    async upsertAll(
        manager: EntityManager,
        records: ReadonlyArray<AuthorityActionRecord>,
    ): Promise<AuthorityActionsSyncReport> {
        const written = await manager.query<Array<Pick<AuthorityActionsRow, "action">>>(UPSERT_AUTHORITY_ACTIONS, [
            JSON.stringify(records),
        ])
        const held = await manager.query<Array<Pick<AuthorityActionsRow, "action">>>(LIST_ACTION_KEYS)
        const keys = new Set(written.map((row) => row.action))
        return { written: written.length, stale: held.map((row) => row.action).filter((action) => !keys.has(action)) }
    }

    /** Every action of the catalogue, read through the manager the caller hands in. */
    list(manager: EntityManager): Promise<Array<AuthorityActionRecord>> {
        return manager.query<Array<AuthorityActionRecord>>(LIST_AUTHORITY_ACTIONS)
    }
}
