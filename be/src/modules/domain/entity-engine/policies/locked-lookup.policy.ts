import { advisoryXactLock } from "@modules/platform/database"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { Scalar } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog, RecordRow } from "./compiler.contracts"
import { findRecordByFields } from "./find-by-fields.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/**
 * Finds the record a key names under a transaction-scoped advisory lock, so two transactions that look for the same key take turns:
 * the lock key is the entity, the workspace, the key's name and its values. A key with a null value never matches (nulls are never
 * equal), so nothing is read for it. The lock is released when the transaction ends.
 */
export const lockedLookup = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entity: EntityDefinition,
    keyName: string,
    fields: ReadonlyArray<readonly [string, Scalar]>,
): Promise<RecordRow | null> => {
    await advisoryXactLock(tx.manager, JSON.stringify([entity.name, tx.workspaceId, keyName, fields]))
    return fields.some(([, value]) => value === null) ? null : findRecordByFields(tx, catalog, entity, fields)
}
