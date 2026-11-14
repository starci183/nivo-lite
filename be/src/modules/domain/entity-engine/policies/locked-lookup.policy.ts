import { advisoryXactLock } from "@modules/platform/database"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Scalar } from "@nivo-lite/agent-sdk/query"
import type { EntityCatalog } from "./compiler.contracts"
import { findRecordByFields } from "./find-by-fields.policy"
import { keyAgentOf } from "./record-scope.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/**
 * Finds the record a key names under a transaction-scoped advisory lock, so two transactions that look for the same key take turns:
 * the lock key is the entity, the workspace, the agent the key lives in (`keyAgentOf`), the key's name
 * and its values. A key with a null value never matches (nulls are never
 * equal), so nothing is read for it. The lock is released when the transaction ends.
 */
export const lockedLookup = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entity: EntityDefinition,
    keyName: string,
    fields: ReadonlyArray<readonly [string, Scalar]>,
): Promise<RecordRow | null> => {
    const agent = keyAgentOf(tx)
    const lock = agent === null ? [entity.name, tx.workspaceId, keyName, fields] : [entity.name, tx.workspaceId, agent, keyName, fields]
    await advisoryXactLock(tx.manager, JSON.stringify(lock))
    return fields.some(([, value]) => value === null) ? null : findRecordByFields(tx, catalog, entity, fields)
}
